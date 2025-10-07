.PHONY: init build-deps help

# Initialize and update git submodules
init:
	git submodule update --init --recursive

build-token:
	cd deps/aztec-standards && aztec-nargo compile && aztec-postprocess-contract && aztec codegen -o ./artifacts target

build-contract: 
	cd contract && aztec-nargo compile && aztec-postprocess-contract && aztec codegen -o ./artifacts target

# Build dependencies by running 'just build' in the WebZjs submodule
build-deps:
	cd deps/WebZjs && just build

# Display help information
help:
	@echo "Available commands:"
	@echo "  init       - Initialize and update git submodules"
	@echo "  build-deps - Build dependencies in WebZjs submodule"
	@echo "  help       - Show this help message"
