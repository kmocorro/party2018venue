let jwt = require('jsonwebtoken');
let config = require('../config').authSecret;
let formidable = require('formidable');
let mysql = require('../config');

module.exports = function(app){

    /** API user login */
    app.post('/api/login', function(req, res){
        let form = new formidable.IncomingForm();

        //console.log(form);
        form.parse(req, function(err, fields){
            if(err){return res.send({err: 'Form parse error.'})};

            if(fields){
                let form_login_details = fields;

                //console.log(fields);

                if(form_login_details.employeeNumber){
                
                    function checkEmployeeNumber(){
                        return new Promise(function(resolve, reject){
                            
                            mysql.poolParty.getConnection(function(err, connection){

                                connection.query({
                                    sql: 'SELECT * FROM app_venue_party_list WHERE employeeNumber = ?',
                                    values: [form_login_details.employeeNumber]
                                },  function(err, results){
                                    if(err){return res.send({err: 'Error query on employee number'})};

                                    let employeeDetails = [];

                                    if(typeof results[0] !== 'undefined' && results[0] !== null && results.length > 0){
                                        
                                        let token = jwt.sign({
                                            id: results[0].id,
                                            claim: {
                                                employeeNumber: results[0].employeeNumber,
                                                lastname: results[0].lastname,
                                                firstname: results[0].firstname,
                                                middlename: results[0].middlename,
                                                fullname: results[0].firstname + ' ' + results[0].lastname,
                                                title: results[0].title,
                                                department: results[0].department,
                                                shift: results[0].shift,
                                                attendance: results[0].attendance,
                                                awardee: results[0].awardee,
                                                hiredate: results[0].hiredate,
                                                id: results[0].id
                                            }
                                        },  config.secret);

                                        employeeDetails.push({
                                            employeeNumber: results[0].employeeNumber,
                                            lastname: results[0].lastname,
                                            firstname: results[0].firstname,
                                            middlename: results[0].middlename,
                                            fullname: results[0].firstname + ' ' + results[0].lastname,
                                            title: results[0].title,
                                            department: results[0].department,
                                            shift: results[0].shift,
                                            attendance: results[0].attendance,
                                            awardee: results[0].awardee,
                                            hiredate: results[0].hiredate,
                                            id: results[0].id
                                        });

                                        res.cookie('auth', token);
                                        res.status(200).send({auth: 'Authenticated'});

                                        resolve(employeeDetails);

                                    } else {

                                        reject('Invalid Employee Number.');

                                    }

                                });

                                connection.release();

                            });
                            

                        });

                    }

                    checkEmployeeNumber().then(function(employeeDetails){
                        //console.log(employeeDetails);
                    },  function(err){
                        if(err){return res.send({err: err})};
                    });

                } else {
                    res.send({err: 'No fields found'});
                }

            } else {
                res.send({err: 'No fields found'});
            }


        });

    });

}