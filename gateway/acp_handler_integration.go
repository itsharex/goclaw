package gateway

import (
	"reflect"

	"github.com/smallnest/goclaw/acp"
)

// registerAcpMethods 注册 ACP 方法
func (h *Handler) registerAcpMethods() {
	// Use reflection to properly check if interface is nil
	// This handles the case where a typed nil pointer is passed as interface{}
	if h.acpMgr == nil || reflect.ValueOf(h.acpMgr).IsNil() {
		return
	}

	// Type assert to *acp.Manager
	acpManager, ok := h.acpMgr.(*acp.Manager)
	if !ok {
		// Not a valid ACP manager, skip registration
		return
	}

	// Register ACP methods using the gateway registration function
	RegisterAcpMethods(h.registry, h.cfg, acpManager)
}
