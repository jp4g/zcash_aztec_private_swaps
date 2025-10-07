use std::{collections::HashMap, num::NonZero, str::FromStr, sync::Arc, time::Duration};

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use tonic::{
    transport::{Channel, ClientTlsConfig, Endpoint},
    IntoRequest,
};
use tower_http::cors::CorsLayer;
use webzjs_common::Network;
use webzjs_wallet::Wallet;
use zcash_client_backend::data_api::WalletRead;
use zcash_client_backend::proto::service::{
    compact_tx_streamer_client::CompactTxStreamerClient, ChainSpec,
};
use zcash_client_memory::MemoryWalletDb;

lazy_static! {
    static ref SEED_PHRASE: String = std::env::var("SEED_PHRASE").unwrap_or_else(|_| {
        eprintln!("Error: SEED_PHRASE environment variable not found");
        std::process::exit(1);
    });
    static ref LIGHT_CLIENT_URL: String = std::env::var("LIGHT_CLIENT_URL").unwrap_or_else(|_| {
        eprintln!("Error: LIGHT_CLIENT_URL environment variable not found");
        std::process::exit(1);
    });
    static ref NETWORK: (
        zcash_protocol::consensus::Network,
        zcash_protocol::consensus::NetworkType,
        Network
    ) = {
        let mainnet_str = std::env::var("MAINNET").unwrap_or_else(|_| {
            eprintln!("Error: MAINNET environment variable not found");
            std::process::exit(1);
        });
        let is_mainnet = mainnet_str.to_lowercase() == "true" || mainnet_str == "1";
        if is_mainnet {
            (
                zcash_protocol::consensus::Network::MainNetwork,
                zcash_protocol::consensus::NetworkType::Main,
                Network::MainNetwork,
            )
        } else {
            (
                zcash_protocol::consensus::Network::TestNetwork,
                zcash_protocol::consensus::NetworkType::Test,
                Network::TestNetwork,
            )
        }
    };
    static ref BIRTHDAY_HEIGHT: Option<u64> = std::env::var("BIRTHDAY_HEIGHT")
        .ok()
        .and_then(|s| s.parse().ok());
}

pub(crate) const MAX_CHECKPOINTS: usize = 100;
pub(crate) const SYNC_CADENCE: u64 = 5;

type AccountId = <MemoryWalletDb<zcash_protocol::consensus::Network> as WalletRead>::AccountId;
type JobStore = Arc<RwLock<HashMap<String, Job>>>;

struct AppState {
    wallet: Arc<Wallet<MemoryWalletDb<zcash_protocol::consensus::Network>, Channel>>,
    contracts: Arc<RwLock<HashMap<String, (AccountId, u32)>>>,
    jobs: JobStore,
    hd_index: Arc<RwLock<u32>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
enum JobStatus {
    Pending,
    Completed,
}

#[derive(Debug, Clone)]
struct Job {
    status: JobStatus,
    amount: u64,
    price: f64,
    deposit_address: String,
    contract_address: String,
}

#[derive(Deserialize)]
struct CreateJobRequest {
    contract_address: String,
    amount: u64,
}

#[derive(Serialize)]
struct SolveRequest {
    #[serde(rename = "contractAddress")]
    contract_address: String,
    amount: u64,
}

#[derive(Serialize)]
struct CreateJobResponse {
    deposit_address: String,
}

#[derive(Serialize)]
struct JobStatusResponse {
    status: JobStatus,
}

async fn get_address(
    State(state): State<Arc<AppState>>,
    Path(contract_address): Path<String>,
) -> impl IntoResponse {
    println!(
        "get_address called with contract_address: {}",
        contract_address
    );
    // find account id from contract address
    let account_id = {
        let contracts = state.contracts.read().await;
        if let Some((account_id, _)) = contracts.get(&contract_address) {
            *account_id
        } else {
            return (
                StatusCode::NOT_FOUND,
                "Contract address not found".to_string(),
            );
        }
    };
    println!("Found account_id: {:?}", account_id);

    // get the address
    let db = state.wallet.db();
    let db = db.read().await;
    match db.get_current_address(account_id) {
        Ok(Some(address)) => {
            println!("Unified address: {:?}", address);
            let address_string = address.to_address(NETWORK.1);
            println!("Transparent: {:?}", address_string);
            (StatusCode::OK, address_string.to_string())
        }
        Ok(None) => (StatusCode::NOT_FOUND, "Address not found".to_string()),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to get address".to_string(),
        ),
    }
}

async fn sync_wallet(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match state.wallet.sync().await {
        Ok(_) => (StatusCode::OK, "Wallet synced successfully"),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to sync wallet"),
    }
}

async fn get_orchard_balance(
    State(state): State<Arc<AppState>>,
    Path(contract_address): Path<String>,
) -> impl IntoResponse {
    // find account id from contract address
    let account_id = {
        let contracts = state.contracts.read().await;
        if let Some((account_id, _)) = contracts.get(&contract_address) {
            *account_id
        } else {
            return (
                StatusCode::NOT_FOUND,
                "Contract address not found".to_string(),
            );
        }
    };

    // get balance
    match state.wallet.get_wallet_summary().await {
        Ok(Some(summary)) => {
            if let Some(account_balance) = summary.account_balances().get(&account_id) {
                let orchard_balance = u64::from(account_balance.orchard_balance().total());
                (StatusCode::OK, orchard_balance.to_string())
            } else {
                (StatusCode::NOT_FOUND, "Account not found".to_string())
            }
        }
        Ok(None) => (
            StatusCode::NOT_FOUND,
            "No wallet summary available".to_string(),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to get wallet summary".to_string(),
        ),
    }
}

async fn get_current_orchard_balance(
    wallet: &Wallet<MemoryWalletDb<zcash_protocol::consensus::Network>, Channel>,
    account_id: AccountId,
) -> Option<u64> {
    if let Ok(Some(summary)) = wallet.get_wallet_summary().await {
        if let Some(account_balance) = summary.account_balances().get(&account_id) {
            return Some(u64::from(account_balance.orchard_balance().total()));
        }
    }
    None
}

async fn get_required_amount(requested: u64) -> Result<(f64, u64), Box<dyn std::error::Error>> {
    // get the current price of zcash in usd from coingecko api
    let response =
        reqwest::get("https://api.coingecko.com/api/v3/simple/price?ids=zcash&vs_currencies=usd")
            .await?
            .json::<serde_json::Value>()
            .await?;
    let price = if let Some(price) = response["zcash"]["usd"].as_f64() {
        price
    } else {
        return Err("Failed to get price".into());
    };
    // determine how much zcash is needed to cover the requested usd amount
    let amount_zatoshis = (requested as f64 / price * 10_f64.powi(18)) as u64;
    // convert to zatoshis
    return Ok((price, amount_zatoshis));
}

async fn transfer_to_holding(
    state: Arc<AppState>,
    amount: u64,
    contract_address: String,
) -> Result<(), StatusCode> {
    let holding_address = {
        let db_lock = state.wallet.db();
        let db = db_lock.read().await;
        db.get_current_address(AccountId::from(1))
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .ok_or(StatusCode::NOT_FOUND)?
            .to_address(NETWORK.1)
    };

    let (account_id, hd_index) = {
        let contracts = state.contracts.read().await;
        if let Some((account_id, hd_index)) = contracts.get(&contract_address) {
            (*account_id, *hd_index)
        } else {
            return Err(StatusCode::NOT_FOUND);
        }
    };

    state
        .wallet
        .transfer(&SEED_PHRASE, hd_index, account_id, holding_address, amount)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    println!("Transferred {} zatoshis to holding address", amount);
    Ok(())
}

async fn create_job(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CreateJobRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    // ensure the contract address doesn't already have a job
    {
        let jobs = state.jobs.read().await;
        if jobs.get(&request.contract_address).is_some() {
            return Err(StatusCode::CONFLICT);
        }
    }

    // create a new account for this job
    let account_id = {
        // create new account at current hd_index
        let mut hd_index = state.hd_index.write().await;
        let account_id = state
            .wallet
            .create_account(
                &format!("Job Account {}", hd_index),
                &SEED_PHRASE,
                *hd_index,
                None,
                None,
            )
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        // store the account ID for the contract
        let mut contracts = state.contracts.write().await;
        contracts.insert(request.contract_address.clone(), (account_id, *hd_index));

        // increment hd_index
        *hd_index += 1;

        account_id
    };

    // Get deposit address
    let deposit_address = {
        let db = state.wallet.db();
        let db = db.read().await;
        match db.get_current_address(account_id) {
            Ok(Some(address)) => address
                .to_address(NETWORK.1)
                .to_string(),
            _ => return Err(StatusCode::INTERNAL_SERVER_ERROR),
        }
    };

    // determine the price and amount needed
    let (price, amount) = match get_required_amount(request.amount).await {
        Ok(val) => val,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    // Create job
    let job = Job {
        status: JobStatus::Pending,
        amount,
        price,
        deposit_address: deposit_address.clone(),
        contract_address: request.contract_address.clone(),
    };

    // Store job
    state
        .jobs
        .write()
        .await
        .insert(request.contract_address.clone(), job);

    // Spawn background task to monitor balance
    let wallet = state.wallet.clone();
    let jobs = state.jobs.clone();
    let contract_address_clone = request.contract_address.clone();

    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(10)).await;

            println!("checking shielded balance.....");

            if let Some(current_balance) = get_current_orchard_balance(&wallet, account_id).await {
                let (should_complete, contract_address, amount) = {
                    let mut jobs_lock = jobs.write().await;
                    if let Some(job) = jobs_lock.get_mut(&contract_address_clone) {
                        println!("current balance: {}", current_balance);

                        if current_balance >= job.amount {
                            job.status = JobStatus::Completed;
                            println!("job {:?} completed", job);
                            (true, job.contract_address.clone(), job.amount)
                        } else {
                            (false, String::new(), 0)
                        }
                    } else {
                        break;
                    }
                };

                if should_complete {
                    // transfer funds to holding
                    transfer_to_holding(state, amount, contract_address.clone()).await;
                    // Call solve endpoint
                    let client = reqwest::Client::new();
                    let solve_request = SolveRequest {
                        contract_address,
                        amount,
                    };

                    match client
                        .post("http://localhost:4000/solve")
                        .json(&solve_request)
                        .send()
                        .await
                    {
                        Ok(response) => {
                            println!(
                                "Solve endpoint called successfully: {:?}",
                                response.status()
                            );
                        }
                        Err(e) => {
                            eprintln!("Failed to call solve endpoint: {:?}", e);
                        }
                    }
                    break;
                }
            }
        }
    });

    Ok(Json(CreateJobResponse { deposit_address }))
}

async fn get_job_status(
    State(state): State<Arc<AppState>>,
    Path(job_id): Path<String>,
) -> impl IntoResponse {
    let jobs = state.jobs.read().await;

    if let Some(job) = jobs.get(&job_id) {
        (
            StatusCode::OK,
            Json(JobStatusResponse {
                status: job.status.clone(),
            }),
        )
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(JobStatusResponse {
                status: JobStatus::Pending,
            }),
        )
    }
}

async fn setup_wallet() -> Result<
    Wallet<MemoryWalletDb<zcash_protocol::consensus::Network>, Channel>,
    Box<dyn std::error::Error>,
> {
    dotenvy::dotenv().ok();

    // setup connection
    let tls_config = ClientTlsConfig::new().with_native_roots();
    let channel = Endpoint::from_shared(LIGHT_CLIENT_URL.clone())?
        .tls_config(tls_config)?
        .connect()
        .await?;
    let mut test_client = CompactTxStreamerClient::new(channel.clone());
    let request = ChainSpec::default();
    let latest_block = test_client.get_latest_block(request.into_request()).await?;
    println!("latest block: {:?}", latest_block);
    // setup wallet
    let db = MemoryWalletDb::new(NETWORK.0, MAX_CHECKPOINTS);
    let wallet = Wallet::new(db, channel, NETWORK.2, NonZero::from_str("1")?)?;

    // choose birthday height
    let birthday_height: u64 = BIRTHDAY_HEIGHT.unwrap_or_else(|| {
        println!(
            "BIRTHDAY_HEIGHT not set, using latest block height: {}",
            latest_block.get_ref().height
        );
        latest_block.get_ref().height
    });
    println!("Chose height: {}", birthday_height);
    println!("Latest height: {}", latest_block.get_ref().height);

    wallet
        .create_account(
            "Holding Account",
            &SEED_PHRASE,
            0,
            Some(birthday_height.try_into().unwrap()),
            None,
        )
        .await?;

    wallet.sync().await?;

    Ok(wallet)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    let mainnet_str = std::env::var("MAINNET").unwrap_or_else(|_| {
        eprintln!("Error: MAINNET environment variable not found");
        std::process::exit(1);
    });
    let is_mainnet = mainnet_str.to_lowercase() == "true" || mainnet_str == "1";
    println!("Using {} network", if is_mainnet { "mainnet" } else { "testnet" });

    // setup wallet
    let wallet = setup_wallet().await?;
    print!("wallet summary {:?}\n", wallet.get_wallet_summary().await?);

    let app_state = Arc::new(AppState {
        wallet: Arc::new(wallet),
        contracts: Arc::new(RwLock::new(HashMap::new())),
        hd_index: Arc::new(RwLock::new(1)),
        jobs: Arc::new(RwLock::new(HashMap::new())),
    });

    // store holding account "contract" id
    {
        let mut contracts = app_state.contracts.write().await;
        contracts.insert(String::from("default"), (AccountId::from(1), 0));
    }

    // Spawn background task to sync wallet every 15 seconds
    let wallet_for_sync = app_state.wallet.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(SYNC_CADENCE)).await;
            if let Err(e) = wallet_for_sync.sync().await {
                eprintln!("Background sync error: {:?}", e);
            } else {
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::SystemTime::UNIX_EPOCH)
                    .unwrap()
                    .as_secs();
                println!("Background sync completed at {:?}", now);
            }
        }
    });

    // serve intent api
    let app = Router::new()
        .route("/get_address/{contract_address}", get(get_address))
        .route("/sync", get(sync_wallet))
        .route("/orchard_balance", get(get_orchard_balance))
        .route("/create_job", post(create_job))
        .route("/job_status/{job_id}", get(get_job_status))
        .with_state(app_state)
        .layer(CorsLayer::permissive());

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    println!("Server listening on http://0.0.0.0:3000");

    axum::serve(listener, app).await?;

    Ok(())
}
