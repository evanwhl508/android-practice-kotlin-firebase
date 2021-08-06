// const functions = require("firebase-functions");

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// The Cloud Functions for Firebase SDK to create Cloud Functions and setup triggers.
const functions = require('firebase-functions');
var coinsList;

// The Firebase Admin SDK to access Firestore.
const admin = require('firebase-admin');
admin.initializeApp();

var sendNotification = function(data) {
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
    var req = https.request(options, function(res) {  
      res.on('data', function(data) {
        console.log("Response:");
        console.log(JSON.parse(data));
      });
    });
    
    req.on('error', function(e) {
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
        .then(resp => {
            var result = resp.json().catch(() => response.text());
            return result;
        })
        .then(data => {
        // console.log('Data: ', data);
        console.log('Coins: ', data["coins"][0]);
        coinsList = data["coins"];
        });
  };
  
exports.readAlert = functions.https.onRequest(async (req, res) => {
    // Grab the text parameter.
    const original = req.query.text;
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

    var json_res = {};
  
    var message = { 
        app_id: "8ab08e18-1478-4cbc-8adb-800ea92b8519",
        contents: {"en": "English Message"},
        include_player_ids: ["5f0b1cfd-f671-47ee-89b3-c9e5bb338396"]
        // included_segments: ["Subscribed Users"]
      };
    // sendNotification(message);
    getPrice().then(data => {

        alertCoins.forEach(doc => {
            console.log(doc.id, '=>', doc.data());
            var alertPrice = parseInt(doc.get('higher'));
            var alertCoin = doc.get('id');
            coinsList.forEach(coin => {
                if (coin['id'] == alertCoin && parseInt(coin['price']) >= alertPrice) {
                    var message = { 
                        app_id: "8ab08e18-1478-4cbc-8adb-800ea92b8519",
                        contents: {"en": `${alertCoin} archeived $${alertPrice}`},
                        include_player_ids: ["5f0b1cfd-f671-47ee-89b3-c9e5bb338396"]
                        // included_segments: ["Subscribed Users"]
                    };
                    sendNotification(message);
                    const res = db.collection('price_alert').doc('test').collection('coins').doc(`${doc.id}`).update({
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