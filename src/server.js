require("dotenv").config();
const express = require("express");
const cors = require("cors");
const database = require("./config/database");

const PORT = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json());

// Rotas
const medicoesRoutes = require("./routes/medicoes");
const solicitacoesRoutes = require("./routes/solicitacoes");
const authRoutes = require("./routes/auth");

app.use("/api/medicoes", medicoesRoutes);
app.use("/api/solicitacoes", solicitacoesRoutes);
app.use("/api/auth", authRoutes);

async function start() {
    await database.connect();
    app.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
    });
}

start().catch((err) => {
    console.error("Erro ao iniciar a aplicação:", err);
    process.exit(1);
});