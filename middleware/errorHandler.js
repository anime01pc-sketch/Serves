function errorHandler(err, req, res, next) {
  console.error('Error:', err.message);
  console.error(err.stack);

  const statusCode = err.status || 500;
  const message = statusCode === 500 ? 'Internal server error' : err.message;

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

module.exports = errorHandler;