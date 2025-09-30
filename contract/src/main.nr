use aztec::macros::aztec;

pub mod types;

#[aztec]
pub contract PrivatePayment {

    use aztec::{
        context::{PrivateContext, PublicContext},
        macros::{
            functions::{initializer, internal, private, public, utility, view},
            storage::storage,
        },
        messages::logs::note::encode_and_encrypt_note,
        protocol_types::{
            address::AztecAddress,
            constants::CONTRACT_INSTANCE_REGISTRY_CONTRACT_ADDRESS,
            contract_class_id::ContractClassId,
            traits::{FromField, ToField},
        },
        state_vars::{Map, public_immutable::PublicImmutable, public_mutable::PublicMutable
        , private_immutable::PrivateImmutable
        },
    };

    use address_note::address_note::AddressNote;
    use uint_note::uint_note::UintNote;
    use value_note::value_note::ValueNote;

    use token_contract::Token;

    #[storage]
    struct Storage<Context> {
        token_address: PrivateImmutable<AddressNote, Context>,
        token_amount: PrivateImmutable<UintNote, Context>,
        commitment: PrivateImmutable<ValueNote, Context>,
    }

    #[private]
    #[initializer]
    fn constructor(token_address: AztecAddress, token_amount: u128) {
        let self_address = context.this_address();
        let caller = context.msg_sender();

        let partial_note = Token::at(token_address).initialize_transfer_commitment(
            self_address,
            caller,
            self_address,
        ).call(&mut context);

        storage.token_address.initialize(AddressNote::new(token_address, self_address));
        storage.token_amount.initialize(UintNote::new(token_amount, self_address));
        storage.commitment.initialize(ValueNote::new(partial_note, self_address));
    }
}
