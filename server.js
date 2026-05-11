const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const ROOT = process.cwd(); // Strictly limits the server to this folder
let clients = [];

const server = http.createServer((req, res) => {
  // 1. The Reload Endpoint
  if (req.url === "/reload-stream") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    clients.push(res);
    return;
  }

  // 2. Safe File Path Resolution
  // This prevents the browser from requesting files outside this folder (e.g., /../etc/passwd)
  let safePath = path.normalize(req.url).replace(/^(\.\.[\/\\])+/, "");
  if (safePath === "/" || safePath === ".") safePath = "index.html";

  const fullPath = path.join(ROOT, safePath);

  // Check if the file exists and is inside the project root
  if (!fullPath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Access Denied");
  }

  fs.readFile(fullPath, (err, content) => {
    if (err) {
      res.writeHead(404);
      return res.end("File not found");
    }

    const ext = path.extname(fullPath);
    const mimeTypes = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "text/javascript",
    };
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain" });

    // 3. Auto-Injection of the Refresh Logic
    if (ext === ".html") {
      const injector = `
                <script>
                    const sse = new EventSource('/reload-stream');
                    sse.onmessage = () => {
                        console.log('File change detected. Reloading...');
                        location.reload();
                    };
                </script>
            `;
      res.end(content.toString() + injector);
    } else {
      res.end(content);
    }
  });
});

// 4. Scoped File Watching
// We only watch the current directory.
fs.watch(ROOT, { recursive: true }, (eventType, filename) => {
  if (filename && (filename.endsWith(".html") || filename.endsWith(".css"))) {
    console.log(`[Changed] ${filename} - Refreshing browser...`);
    clients.forEach((client) => client.write("data: reload\n\n"));
    clients = []; // Reset connection list after trigger
  }
});

server.listen(PORT, () => {
  console.log(
    `\x1b[32m%s\x1b[0m`,
    `Local sandbox active: http://localhost:${PORT}`,
  );
  console.log(`Watching for changes in: ${ROOT}`);
});
