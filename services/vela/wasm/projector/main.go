// MoneyPenny Confidential Consequence Projector — WASM entry points.
//
// Thin bridge only: converts raw WASM pointers into Go types and delegates to
// the app package. All logic lives in app/. Build with TinyGo:
//
//	make build            # development
//	make production_build # optimized
//
// This module exports no `trusted_request`: the projector is not a trigger app
// and must not be reachable through the plaintext TRUSTPROCESS path.
package main

import (
	"github.com/HorizenOfficial/vela-common-go/wasm/types"
	"github.com/HorizenOfficial/vela-common-go/wasm/utils"

	"github.com/iQube-Protocol/moneypenny-confidential-projector/app"
)

//export deploy
func deploy(appId int64, paramsPtr *byte, paramsLen int32) *byte {
	paramsJSON := utils.PtrToString(paramsPtr, paramsLen)
	return types.SerializeAndWriteResult(app.Deploy(appId, paramsJSON))
}

//export load_module
func load_module(appId int64) *byte {
	return types.SerializeAndWriteResult(app.LoadModule(appId))
}

//export deposit
func deposit(appId int64, senderPtr *byte, senderLen int32,
	tokenPtr *byte, tokenLen int32,
	valuePtr *byte, valueLen int32,
	statePtr *byte, stateLen int32) *byte {
	_ = appId
	sender := types.PtrToAddress(senderPtr, senderLen)
	token := types.PtrToAddress(tokenPtr, tokenLen)
	value := types.PtrToUint256(valuePtr, valueLen)
	stateJSON := utils.PtrToString(statePtr, stateLen)
	return types.SerializeAndWriteResult(app.DepositFunds(sender, token, value, stateJSON))
}

//export process_request
func process_request(appId int64, senderPtr *byte, senderLen int32,
	requestType int32,
	payloadPtr *byte, payloadLen int32,
	statePtr *byte, stateLen int32) *byte {
	_ = appId
	sender := types.PtrToAddress(senderPtr, senderLen)
	payloadJSON := utils.PtrToString(payloadPtr, payloadLen)
	stateJSON := utils.PtrToString(statePtr, stateLen)
	return types.SerializeAndWriteResult(
		app.ProcessRequest(sender, requestType, payloadJSON, stateJSON),
	)
}

// memoryStats mirrors what the integration-test harnesses expect from
// get_memory_stats. GetAllocatedMemoryStats returns two scalars rather than a
// struct, so the shape is assembled here.
type memoryStats struct {
	MapSize    int64 `json:"mapSize"`
	TotalBytes int64 `json:"totalBytes"`
}

//export get_memory_stats
func get_memory_stats() *byte {
	mapSize, totalBytes := utils.GetAllocatedMemoryStats()
	return types.SerializeAndWriteResult(memoryStats{MapSize: mapSize, TotalBytes: totalBytes})
}

func main() {} // required by Go, unused in WASM
