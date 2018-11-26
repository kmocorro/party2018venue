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

            /** Check if user exists in the party list
             *  party_list_data object 
             */
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
                let current_day = moment(new Date()).format('MMMM DD, YYYY');

                /** validate if user already registered on the venue
                 *  resolve(enter_event_button) return 'enabled' or 'disabled'
                 */
                function validate_user_entry(){
                    return new Promise(function(resolve, reject){

                        mysql.poolParty.getConnection(function(err, connection){
                            if(err){return reject(err)};

                            connection.query({
                                sql: 'SELECT * FROM app_venue_party_day1 WHERE employeeNumber = ?',
                                values: [party_list_data[0].employeeNumber]
                            },  function(err, results){
                                if(err){return reject(err)};

                                let enter_event_button = [];

                                if(typeof results[0] !== 'undefined' && results[0] !== null && results.length > 0){

                                    enter_event_button.push({
                                        stat: 'disabled' // user already exists.
                                    })

                                    resolve(enter_event_button);

                                } else {

                                    //** validate day2 */
                                    connection.query({
                                        sql: 'SELECT * FROM app_venue_party_day2 WHERE employeeNumber = ?',
                                        values: [party_list_data[0].employeeNumber]
                                    },  function(err, results){
                                        if(err){return reject(err)};

                                        if(typeof results[0] !== 'undefined' && results[0] !== null && results.length > 0){

                                            enter_event_button.push({
                                                stat: 'disabled' // user already exists.
                                            })
                                            
                                            resolve(enter_event_button);
                                            //console.log(enter_event_button);

                                        } else {

                                            enter_event_button.push({
                                                stat: 'enabled' // not yet
                                            })
        
                                            resolve(enter_event_button);
                                        }

                                    });

                                }


                            });

                            connection.release();

                        });


                    });
                }

                /** validate if user already claimed food max 1 */
                function validate_user_food(){
                    return new Promise(function(resolve, reject){

                        mysql.poolParty.getConnection(function(err, connection){
                            if(err){return reject(err)};

                            connection.query({
                                sql: 'SELECT * FROM app_venue_stub WHERE employeeNumber = ? AND stub_claim = "food"',
                                values: [party_list_data[0].employeeNumber]
                            },  function(err, results){
                                if(err){return reject(err)};

                                let food_event_button = [];
                                
                                if(typeof results[0] !== 'undefined' && results[0] !== null && results.length > 0){

                                    food_event_button.push({
                                        stat: 'disabled'
                                    });

                                    resolve(food_event_button);

                                } else {

                                    food_event_button.push({
                                        stat: 'enabled'
                                    });

                                    resolve(food_event_button);
                                }
                                

                            });

                            connection.release();

                        });

                    });
                }

                /** validate if user already claimed drinks max 2 */
                function validate_user_drinks(){
                    return new Promise(function(resolve, reject){

                        mysql.poolParty.getConnection(function(err, connection){
                            if(err){return reject(err)};

                            connection.query({
                                sql: 'SELECT *, SUM(stub_qty) AS total_stub FROM app_venue_stub WHERE employeeNumber =? AND stub_claim = "drinks"',
                                values: [party_list_data[0].employeeNumber]
                            },  function(err, results){
                                if(err){return reject(err)};

                                let drinks_event_button = [];

                                if(typeof results[0] !== 'undefined' && results[0] !== null && results.length > 0){

                                    if(results[0].total_stub >= 2){
                                        
                                        drinks_event_button.push({
                                            stat: 'disabled'
                                        });

                                        resolve(drinks_event_button);

                                    } else {

                                        drinks_event_button.push({
                                            stat: 'enabled'
                                        });

                                        resolve(drinks_event_button);
                                    }

                                } else {

                                }

                            });

                        });

                    });
                }


                if(party_list_data[0].shift == 'X' || party_list_data[0].shift == 'Y'){

                    schedule.push({
                        day:  'December 05, 2018'
                    });

                } else {
                    
                    schedule.push({
                        day:  'December 06, 2018'
                    });
                }

                if(party_list_data[0].awardee !== null){

                    let awardee_array = (party_list_data[0].awardee).split(" ");
                    //console.log(awardee_array);

                    service_awardee.push({
                        year: awardee_array[0],
                        batch: awardee_array[2] || '1'
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

                validate_user_entry().then(function(enter_event_button){

                    res.render('home', { party_list_data, authenticity_token, sched: schedule[0].day, award: service_awardee[0], attendance: confirmation_attendance[0], current_day, enter_event_button });

                },  function(err){
                    res.send({err: 'Error validating user entry.' + err});
                });

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

        let credentials = {
            employeeNumber: req.query.employeeNumber
        }

        if(credentials.employeeNumber){

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
                            values: [credentials.employeeNumber]
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

            /**  */
            venue_party_list().then(function(party_list_data){

                let schedule = [];
                let service_awardee = [];
                let confirmation_attendance = [];
                let current_day = moment(new Date()).format('MMMM DD, YYYY');

                if(party_list_data[0].shift == 'X' || party_list_data[0].shift == 'Y'){

                    schedule.push({
                        day:  'December 05, 2018'
                    });

                } else {
                    
                    schedule.push({
                        day:  'December 06, 2018'
                    });
                }

                if(party_list_data[0].awardee !== null){

                    let awardee_array = (party_list_data[0].awardee).split(" ");
                    //console.log(awardee_array);

                    service_awardee.push({
                        year: awardee_array[0],
                        batch: awardee_array[2] || '1'
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


                res.render('home', { party_list_data, authenticity_token, sched: schedule[0].day, award: service_awardee[0], attendance: confirmation_attendance[0], current_day });

            },  function(err){
                res.send({err: err});
            });

        } else {
            res.send({err: 'No employee number.'});
        }

    });

    /** GET API for user LOGOUT PAGE */
    app.get('/logout', function(req, res){
        res.cookie('auth', null);
        res.redirect('/');
    });

    /** API POST SignIn */
    app.post('/api/party', function(req, res){
        let form = new formidable.IncomingForm();

        form.parse(req, function(err, fields){
            if(err){return res.send({err: 'Error form.'})};

            if(fields){
                
                let credentials = {
                    date_time: moment(new Date()).format(),
                    fullname: fields.fullname,
                    employeeNumber: fields.employeeNumber,
                    title: fields.title,
                    shift: fields.shift,
                    department: fields.department,
                    schedule: moment(new Date(fields.schedule)).format('MMMM DD, YYYY')
                }

                let event = {
                    day_one: moment(new Date('December 05, 2018')).format('MMMM DD, YYYY'),
                    day_two: moment(new Date('December 06, 2018')).format('MMMM DD, YYYY')
                }

                let current_day = moment(new Date()).format('MMMM DD, YYYY');

                /** Check Employee if already registered to the event @ DAY 1 */
                function checkUser_Day_One(){
                    return new Promise(function(resolve, reject){

                        mysql.poolParty.getConnection(function(err, connection){
                            if(err){return reject(err)};

                            connection.query({
                                sql: 'SELECT * FROM app_venue_party_day1 WHERE employeeNumber = ?',
                                values: [credentials.employeeNumber]
                            },  function(err, results){
                                if(err){return reject(err)};

                                if(typeof results[0] !== 'undefined' && results[0] !== null && results.length > 0){
                                    reject(results[0].employeeNumber + ' already registered @ DAY 1');
                                } else {
                                    resolve();
                                }

                            });

                            connection.release();

                        });

                    });
                }

                /** Check Employee if already registered to the event @ DAY 2 */
                function checkUser_Day_Two(){
                    return new Promise(function(resolve, reject){

                        mysql.poolParty.getConnection(function(err, connection){
                            if(err){return reject(err)};

                            connection.query({
                                sql: 'SELECT * FROM app_venue_party_day2 WHERE employeeNumber = ?',
                                values: [credentials.employeeNumber]
                            },  function(err, results){
                                if(err){return reject(err)};

                                if(typeof results[0] !== 'undefined' && results[0] !== null && results.length > 0){
                                    reject(results[0].employeeNumber + ' already registered @ DAY 2');
                                } else {
                                    resolve();
                                }

                            });

                            connection.release();

                        });

                    });
                }

                /** if user doesn't registered yet, insert credenitals @ DAY 1 */
                function insertUser_Day_One(){
                    return new Promise(function(resolve, reject){

                        mysql.poolParty.getConnection(function(err, connection){
                            if(err){return reject(err)};

                            connection.query({
                                sql: 'INSERT INTO app_venue_party_day1 SET date_time= ?, fullname= ?, employeeNumber = ?, title =?, shift = ?, department =?',
                                values: [credentials.date_time, credentials.fullname, credentials.employeeNumber, credentials.title, credentials.shift, credentials.department]
                            },  function(err, results){
                                if(err){return reject(err)};
                                resolve();
                            });

                        });

                    });
                }

                /** if user doesn't registered yet, insert credenitals @ DAY 2 */
                function insertUser_Day_Two(){
                    return new Promise(function(resolve, reject){

                        mysql.poolParty.getConnection(function(err, connection){
                            if(err){return reject(err)};

                            connection.query({
                                sql: 'INSERT INTO app_venue_party_day2 SET date_time= ?, fullname= ?, employeeNumber = ?, title =?, shift = ?, department =?',
                                values: [credentials.date_time, credentials.fullname, credentials.employeeNumber, credentials.title, credentials.shift, credentials.department]
                            },  function(err, results){
                                if(err){return reject(err)};
                                resolve();
                            });

                        });

                    });
                }


                /** separate date registration */
                if(credentials.schedule == event.day_one){ // day one

                    checkUser_Day_One().then(function(){
                        insertUser_Day_One().then(function(){
                            res.send({auth: 'You have successfully joined the party!'});
                        });

                    },  function(err){
                        res.send({err: err});
                    });


                } else if(credentials.schedule == event.day_two){ // day two

                    checkUser_Day_Two().then(function(){
                        insertUser_Day_Two().then(function(){
                            res.send({auth: 'You have successfully joined the party!'});
                        });

                    },  function(err){
                        res.send({err: err});
                    });

                }

            }

        });


    });

}  