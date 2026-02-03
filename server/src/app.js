import { httpServer } from "./index.js";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
connectDB().then(() => {
    httpServer.listen(env.PORT, () => {
        console.log("Server is running on port " + env.PORT);
    });
}).catch((error) => {
    console.error("MongoDB connection error:", error);
    process.exit(1);
});