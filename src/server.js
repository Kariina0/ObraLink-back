require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

console.log("MONGODB_URI:", MONGODB_URI);

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

// Conexão com MongoDB
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log("MongoDB conectado com sucesso!"))
.catch((err) => console.error("Erro ao conectar ao MongoDB:", err));

// Inicialização do servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});