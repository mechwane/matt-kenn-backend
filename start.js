const app = require('./server');
const PORT = process.env.PORT || 3001;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Matt-Kenn Backend running on port ${PORT}`);
});