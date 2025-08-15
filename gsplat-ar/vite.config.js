/// <reference types="node" />

import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";

const COI_HEADERS = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  plugins: [mkcert()],
  server: {
    https: true,     // dev용 자동 인증서
    host: true,      // 같은 Wi-Fi의 다른 기기(폰)에서 접속 가능
    port: 5173,
    headers: COI_HEADERS,  // SharedArrayBuffer 필요 시
  },
  preview: {
    headers: COI_HEADERS,
  },
});
