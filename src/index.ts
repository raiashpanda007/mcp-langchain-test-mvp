import express from 'express';
import { PORT } from './config';


const app = express();


app.use(express.json());
app.use(express.urlencoded({ extended: false }))


app.get('/health-check',(req,res) =>{
    return res.send("OK");
})


app.listen(PORT, ()=>{
    console.log("MCP and Langchain server is running fine at :: ",PORT)
})

