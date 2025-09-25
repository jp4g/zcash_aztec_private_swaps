.PHONY: init build-deps help

# Initialize and update git submodules
init:
	git submodule update --init --recursive

# Build dependencies by running 'just build' in the WebZjs submodule
build-deps:
	cd deps/WebZjs && just build

# Display help information
help:
	@echo "Available commands:"
	@echo "  init       - Initialize and update git submodules"
	@echo "  build-deps - Build dependencies in WebZjs submodule"
	@echo "  help       - Show this help message"
