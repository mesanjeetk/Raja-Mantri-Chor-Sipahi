import { httpServer } from "./index.js";
import { env } from "./config/env.js";

httpServer.listen(env.PORT, () => {
    console.log("Server is running on port " + env.PORT);
});