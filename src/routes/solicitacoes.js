const express = require("express");
const router = express.Router();

let solicitacoes=[];

router.post("/",(req,res)=>{

const {itens}=req.body;

const nova={

id:Date.now(),
itens,
status:"Em análise"

};

solicitacoes.push(nova);

res.json(nova);

});

router.get("/",(req,res)=>{

res.json(solicitacoes);

});

module.exports=router;