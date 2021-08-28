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

var roundToTwoDecimalPlaces = function(num: number) : number {
  return Math.round((num + Number.EPSILON) * 100) / 100
}

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


  exports.buyCoin = functions.https.onCall(async (data, context) => {
    const timestamp = Date.now();
    let username = data.username;
    let pair = data.pair;
    let price = data.price;
    let amount = data.amount;
    let imgUrl = data.imgUrl;

    const db = admin.firestore()

    let usdtBalance: number = 0
    await db.doc(`users/${username}/balance/tether`).get().then((doc) => {
      if (doc.exists) {
        usdtBalance = doc.get("amount");
      }
    }).catch((error) => {
      console.log("Error getting document:", error);
      throw new functions.https.HttpsError('unknown', 'ERROR Document', { message: "Error getting document:" + error});
    });

    let transactions = db.collection(`users/${username}/transaction`);

    if (usdtBalance < roundToTwoDecimalPlaces(amount * price)) {
      console.error("Not enough Money. current: " + usdtBalance + " needed: " + amount * price);
      throw new functions.https.HttpsError("invalid-argument", 'Not Enough Money', { message: "Not enough Money. current: " + usdtBalance + " needed: " + amount * price});
    } else {
      
    let targetBalance = 0
    await db.doc(`users/${username}/balance/${pair}`).get().then((doc) => {
      if (doc.exists) {
        targetBalance = doc.get("amount");
      }
    }).catch((error) => {
      console.log("Error getting document:", error);
      throw new functions.https.HttpsError("unknown", 'ERROR Document', { message: "Error getting document:" + error});
    });
      usdtBalance  = roundToTwoDecimalPlaces(usdtBalance - amount * price)
      targetBalance = roundToTwoDecimalPlaces(targetBalance + amount)
  
      await transactions.add({
          'timestamp': timestamp,
          'price': price,
          'amount': amount,
          'direction': 'buy',
          'symbol': pair
      });
  
      await db.doc(`users/${username}/balance/tether`).set({'symbol': 'tether', 'amount': usdtBalance} ,{'merge':true});
      await db.doc(`users/${username}/balance/${pair}`).set({'symbol': pair, 'amount': targetBalance, 'imgUrl': imgUrl} ,{'merge':true});
    }
});

exports.sellCoin = functions.https.onCall(async (data, context) => {
  const timestamp = Date.now();
  let username = data.username;
  let pair = data.pair;
  let price = data.price;
  let amount = data.amount;

  const db = admin.firestore()

  let usdtBalance: number = 0
  let targetBalance: number = 0
  let a = await db.doc(`users/${username}/balance/tether`).get()
  .then((doc) => {
    if (doc.exists) {
      usdtBalance = doc.get("amount");
    }
  }).catch((error) => {
    console.log("Error getting document:", error);
    throw new functions.https.HttpsError('unknown', 'ERROR Document', { message: "Error getting document:" + error});
  });
  let b = await db.doc(`users/${username}/balance/${pair}`).get()
  .then((doc) => {
    if (doc.exists) {
      targetBalance = doc.get("amount");
    }
  }).catch((error) => {
    console.log("Error getting document:", error);
    throw new functions.https.HttpsError('unknown', 'ERROR Document', { message: "Error getting document:" + error});
  });

  // await Promise.all([a,b]).then((res) => {
  //   res[0]
  // }).catch()

  let transactions = db.collection(`users/${username}/transaction`);

  if (targetBalance < roundToTwoDecimalPlaces(amount)) {
    console.error("Not enough Amount for "+ pair +". current: " + targetBalance + " needed: " + amount);
    throw new functions.https.HttpsError("invalid-argument", 'Not Enough Amount', { message: "Not enough Amount. current: " + targetBalance + " needed: " + amount});
  } 
  else {
    
    usdtBalance  = roundToTwoDecimalPlaces(usdtBalance + amount * price)
    targetBalance = roundToTwoDecimalPlaces(targetBalance - amount)

    await transactions.add({
        'timestamp': timestamp,
        'price': price,
        'amount': amount,
        'direction': 'sell',
        'symbol': pair
    });

    await db.doc(`users/${username}/balance/tether`).set({'amount': usdtBalance} ,{'merge':true});
    await db.doc(`users/${username}/balance/${pair}`).set({'amount': targetBalance} ,{'merge':true});
      }
});
