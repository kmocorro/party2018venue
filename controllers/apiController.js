let bodyParser = require('body-parser');
let { Image } = require('canvas');
const { createCanvas, loadImage } = require('canvas')
const canvas = createCanvas(200, 200);
const ctx = canvas.getContext('2d');

let jwt = require('jsonwebtoken');
let config = require('../config').authSecret;
let verifyToken = require('../authController/verifyToken');

let moment = require('moment');
let formidable = require('formidable');
let mysql = require('../config');
let QRcode = require('qrcode');

let uuidv4 = require('uuid/v4');

module.exports = function(app){
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: true}));

    // api QR generator
    /**
     *         

        QRcode.toDataURL('hello world!',  function(err, url){
            if(err){console.log(err)};
            console.log(url);

            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0)
            img.onerror = err => { throw err }

            img.src = url;

            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(
              '<img src="' + img.src + '" />'
            )

        });

        QRcode.toFile('./filename.png', 'hello world!', {
            color: {
              dark: '#000000ff',  // black dots
              light: '#ffffffff' // white background
            }
        }, function (err) {
            if (err) throw err
            console.log('done')
        });

    */
   

    /** First page */
    app.get('/', verifyToken, function(req, res){
        res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.header('Expires', '-1');
        res.header('Pragma', 'no-cache');

        //console.log(req.userID + req.claim);

        if(req.userID && req.claim){
            let authenticity_token = jwt.sign({
                id: uuidv4(),
                claim: {
                    signup: 'valid'
                }
            }, config.secret);

            /** party_list_data object */
            function venue_party_list(){
                return new Promise(function(resolve, reject){

                    mysql.poolParty.getConnection(function(err, connection){
                        if(err){return reject(err)};

                        connection.query({
                            sql: 'SELECT * FROM app_venue_party_list WHERE employeeNumber = ?',
                            values: [req.claim.employeeNumber]
                        },  function(err, results){
                            if(err){return reject(err)};

                            let party_list_data = [];

                            if(typeof results[0] !== 'undefined' && results[0] !== null && results.length > 0){

                                party_list_data.push({
                                    employeeNumber: results[0].employeeNumber,
                                    lastname: results[0].lastname,
                                    firstname: results[0].firstname,
                                    middlename: results[0].middlename,
                                    fullname: results[0].firstname + ' ' + results[0].lastname,
                                    title: results[0].title,
                                    department: results[0].department,
                                    shift: results[0].shift,
                                    supervisor: results[0].supervisor,
                                    attendance: results[0].attendance,
                                    awardee: results[0].awardee,
                                    hiredate: results[0].hiredate,
                                    id: results[0].id
                                });
                             
                            }

                            resolve(party_list_data);
                            
                        });

                        connection.release();
                    });

                });
            }

            venue_party_list().then(function(party_list_data){

                let schedule = [];
                let service_awardee = [];
                let confirmation_attendance = [];

                if(party_list_data[0].shift == 'X' || party_list_data[0].shift == 'Y'){

                    schedule.push({
                        day:  'December 5, 2018'
                    });

                } else {
                    
                    schedule.push({
                        day:  'December 6, 2018'
                    });
                }

                if(party_list_data[0].awardee !== null){

                    let awardee_array = (party_list_data[0].awardee).split(" ");
                    console.log(awardee_array);

                    service_awardee.push({
                        year: awardee_array[0],
                        batch: awardee_array[2]
                    });

                    
                } else {
                    service_awardee.push({
                        year: '',
                        batch: ''
                    });
                }

                if(party_list_data[0].attendance !== null){

                    if(party_list_data[0].attendance == '1'){

                        confirmation_attendance.push({
                            remarks: 'Confirmed'
                        });

                    } else {

                        confirmation_attendance.push({
                            remarks: 'Declined'
                        });
                    }

                } else {

                    confirmation_attendance.push({
                        remarks: 'Not Registered'
                    });
                }

                res.render('home', { party_list_data, authenticity_token, sched: schedule[0].day, award: service_awardee[0], attendance: confirmation_attendance[0] });
            },  function(err){
                res.send({err: err});
            });

        } else {
            res.redirect('login');
        }

    });


    /** GET API for user LOGIN PAGE */
    app.get('/login', function(req, res){

        let authenticity_token = jwt.sign({
            id: uuidv4(),
            claim: {
                signup: 'valid'
            }
        }, config.secret, { expiresIn: 300 });

        res.render('login', {authenticity_token});
    });

    /** GET API QR CODE query no need to verifyToken */
    app.get('/qrcode', function(req, res){


    });

    /** GET API for user LOGOUT PAGE */
    app.get('/logout', function(req, res){
        res.cookie('auth', null);
        res.redirect('/');
    });
    

}  