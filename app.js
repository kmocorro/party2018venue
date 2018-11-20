let express = require('express');
let app = express();
let server = require('http').Server(app);
let io = require('socket.io')(server);


let cookieParser = require('cookie-parser');
let authController = require('./authController/verifyLogin');
let apiController = require('./controllers/apiController');

let port = process.env.PORT || 9000;

app.use('/', express.static(__dirname + '/public'));
app.set('view engine', 'ejs');

app.use(cookieParser());
authController(app);
apiController(app);

//app.listen(port);
server.listen(port);
