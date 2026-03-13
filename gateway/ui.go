package gateway

//go:generate sh -c "rm -rf ui_dist && cp -r ../ui/dist ui_dist"

import (
	"embed"
	"net/http"
)

// UI 静态文件嵌入
//
//go:embed ui_dist
var uiDist embed.FS

// UIStaticHandler 创建 UI 静态文件处理器
// 使用 embed.FS 提供打包在程序中的静态文件
func UIStaticHandler() http.Handler {
	// 创建 FileServer，托管 uiDist 中的文件
	fs := http.FileServer(http.FS(uiDist))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		// 处理 /ui 根路径，重定向到 /ui/
		if path == "/ui" {
			http.Redirect(w, r, "/ui/index.html", http.StatusMovedPermanently)
			return
		}

		// 处理 /ui/ 开头的路径
		if len(path) >= 4 && path[:4] == "/ui/" {
			// 去掉 /ui 前缀，让 FileServer 从根目录找文件
			r.URL.Path = path[3:] // 变成 /xx
		} else if path == "/ui/" {
			// /ui/ -> /index.html
			r.URL.Path = "/index.html"
		}
		r.URL.Path = "/ui_dist/" + r.URL.Path
		fs.ServeHTTP(w, r)
	})
}
