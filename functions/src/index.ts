import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
export const helloWorld = functions.https.onRequest((request, response) => {
  functions.logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});

let coinsList: any;

admin.initializeApp();

var sendNotification = function(data: { 
                                        app_id: string; 
                                        contents: { en: string; }; 
                                        include_player_ids: string[]; 
                                    }) {
    var headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Authorization": "Basic NzgzZWMzMGQtNjQ0ZC00ZjU2LWJlNTgtMzllNTBiYTUyNjMw"
    };
    
    var options = {
      host: "onesignal.com",
      port: 443,
      path: "/api/v1/notifications",
      method: "POST",
      headers: headers
    };
    
    var https = require('https');
    var req = https.request(options, function(res: { on: (arg0: string, arg1: (data: any) => void) => void; }) {  
      res.on('data', function(data) {
        console.log("Response:");
        console.log(JSON.parse(data));
      });
    });
    
    req.on('error', function(e: any) {
      console.log("ERROR:");
      console.log(e);
    });
    
    req.write(JSON.stringify(data));
    req.end();
  };

  var getPrice = function(){
    const fetch = require('node-fetch');  
    const url = "https://api.coinstats.app/public/v1/coins?skip=0&limit=10";
      return fetch(url)
        .then((resp: { json: () => Promise<any>; }) => {
            var result = resp.json();
            return result;
        })
        .then((data: { [x: string]: any; }) => {
        // console.log('Data: ', data);
        console.log('Coins: ', data["coins"][0]);
        coinsList = data["coins"];
        });
  };
  
exports.readAlert = functions.https.onRequest(async (req, res) => {
    // Grab the text parameter.
    // const original = req.query.text;
    // Push the new message into Firestore using the Firebase Admin SDK.
    const db = admin.firestore()
    // Get the `FieldValue` object
    const FieldValue = admin.firestore.FieldValue;
    const alertCoins = await db
                        .collection('price_alert')
                        .doc('test')
                        .collection('coins').get();
                                //    .doc('bitcoin').get();
    // Send back a message that we've successfully written the message

    var json_res: any = {};
  
    getPrice().then(() => {

        alertCoins.forEach(doc => {
            console.log(doc.id, '=>', doc.data());
            var alertPrice = parseInt(doc.get('higher'));
            var alertCoin = doc.get('id');
            coinsList.forEach((coin: { [x: string]: string; }) => {
                if (coin['id'] == alertCoin && parseInt(coin['price']) >= alertPrice) {
                    var message = { 
                        app_id: "8ab08e18-1478-4cbc-8adb-800ea92b8519",
                        contents: {"en": `${alertCoin} archeived $${alertPrice}`},
                        include_player_ids: ["5f0b1cfd-f671-47ee-89b3-c9e5bb338396"]
                        // included_segments: ["Subscribed Users"]
                    };
                    sendNotification(message);
                    db.collection('price_alert').doc('test').collection('coins').doc(`${doc.id}`).update({
                        higher: FieldValue.delete()
                      });
                    console.log('Message Pushed.')
                }
            });
            json_res[doc.id] = `Alert: ${doc.id} with price ${doc.get('higher')} and test: ${doc.get('test')}`
        });
    })
    res.json(json_res);
  });


exports.buyCoin = functions.https.onRequest(async (req, res) => {
    switch (req.method) {
        case 'POST':
            const timestamp = Date.now();
            const body = req.body
            console.log(`body = ${body}`)
            const username = body.username;
            const pair = body.pair;
            let amount = parseInt(body.amount);
            console.log(`username = ${username}, pair = ${pair}, amount = ${amount}, `)

            const db = admin.firestore()

            const checkBalance = async () => {
                db.collection('balance').doc(username).get().then((doc) => {
                if (!doc.exists) {
                    // doc.data() will be undefined in this case
                    db.collection('balance').doc(username).set({'usdt': 0});
                }
                }).catch((error) => {
                    console.log("Error getting document:", error);
                });
            }
            await checkBalance();
            let userBalance: FirebaseFirestore.DocumentData = db.collection('balance').doc(username);

            const transactions = db.doc(`transaction/${username}/buy/${pair}_${timestamp}`);
            const usdtBalance = (await userBalance.get()).data().usdt;


            transactions.set({
                'timestamp': timestamp,
                'price': 1234.5678,
                'amount': amount,
            });

            userBalance.set({'usdt': usdtBalance + amount}, {merge: true});
            res.json({"success": true});
            break;
        default:
            res.status(403).send('Forbidden!');
    }
});
