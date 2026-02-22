const express = require("express");
const router = express.Router();

let medicoes = [];

router.post("/", (req,res)=>{

const {descricao,foto}=req.body;

const nova={

id:Date.now(),
descricao,
foto

};

medicoes.push(nova);

res.json(nova);

});

router.get("/",(req,res)=>{

res.json(medicoes);

});

module.exports=router;