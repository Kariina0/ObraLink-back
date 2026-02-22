require("dotenv").config();

console.log("MONGODB_URI:", process.env.MONGODB_URI);

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const medicoesRoutes = require("./routes/medicoes");
const solicitacoesRoutes = require("./routes/solicitacoes");

const mongoose = require("mongoose");

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB conectado"))
.catch(err => console.log(err));

app.use("/api/medicoes", medicoesRoutes);
app.use("/api/solicitacoes", solicitacoesRoutes);

app.listen(5000, () => {
  console.log("Servidor rodando na porta 5000");
});