const http = require('http');
const routes = require('./routes');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const method = req.method;
  let route = routes[url.pathname];

  // Handle parameterized routes like /stock/:param
  if (!route && url.pathname.startsWith('/stock/')) {
    const param = url.pathname.split('/stock/')[1];
    if (param) {
      req.param = param;
      route = routes['/stock'];
    }
  }

  if (route && route[method]) {
    route[method](req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

