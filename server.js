import express from 'express';
import http from 'http';
import {WebSocketServer} from 'ws';
import {redisPub,redisSub} from './connection.js'

const app=express();

app.set("view engine",'ejs');
const server=http.createServer(app);
const port=process.env.PORT || 3000;
const REDID_CHANNEL="ws-messages";

const wss= new WebSocketServer({server})

redisSub.subscribe(REDID_CHANNEL)
redisSub.on("message",(channel,message)=>{
    if(channel==REDID_CHANNEL){
        wss.clients.forEach((client)=>{
            client.send(message.toString());
        })
    }
})

wss.on("connection",(socket)=>{
    console.log("Websocket connection")
    socket.on("message",async(data)=>{
        console.log("Data is :",data.toString());
        // wss.clients.forEach((client)=>{
        //     client.send(data.toString());
        // })
        console.log('publishing msg to broker..')
       await redisPub.publish(REDID_CHANNEL,data.toString());
    })
})

app.get('/',(req,res)=>{
    res.render("index");
})

server.listen(port,()=>{
    console.log(`Server is listening on port :${port}`)
})
