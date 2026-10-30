export function errorHandler(error, _req, res, _next) {
  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Request body must be valid JSON" });
  }
  if (error?.name === "ValidationError") {
    return res.status(400).json({ message: "Invalid data", details: error.message });
  }
  if (error?.code === 11000) {
    return res.status(409).json({ message: "A record with this value already exists" });
  }
  console.error(error);
  res.status(500).json({ message: "Internal server error" });
}
