APP := moneypenny_projector
TINYGO ?= /usr/local/tinygo/bin/tinygo

.PHONY: build production_build clean

build:
	$(TINYGO) build -o build/$(APP).wasm -target=wasi .

production_build:
	$(TINYGO) build -o production_build/$(APP).wasm -opt=s -no-debug -target=wasi .

clean:
	rm -rf build production_build
