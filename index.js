var mongodb = require('mongodb');
var ObjectId = mongodb.ObjectId ;
var express = require('express');
var crypto = require('crypto');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var nodemailer=require('nodemailer');
var session = require('express-session');
const axios = require('axios');

var mongoDB="mongodb+srv://Yash:4gsYRxEVyEYzabc4@cluster0-wynku.mongodb.net/RFID_Demo?retryWrites=true&w=majority";
/*
mongodb+srv://Yash:4gsYRxEVyEYzabc4@cluster0-wynku.mongodb.net/RFID_Demo?retryWrites=true&w=majority
*/

mongoose.connect(mongoDB,{useNewUrlParser:true,useUnifiedTopology: true});
var port=3000;

//---------------Node Mailer----------------//
function generateOTP()
{
	var digits = '0123456789'; 
    let OTP = ''; 
    for (let i = 0; i < 6; i++ ) { 
        OTP += digits[Math.floor(Math.random() * 10)]; 
    } 
    return OTP; 
}

function sendNewUserMail(To,Name)
{
	var otp=generateOTP();
	console.log(otp);
	var mailOptions={
		from:'togetherconnect0@gmail.com',
		to:To,
		subject:'<Our Name> ID Login ['+otp.substring(0,3)+' '+otp.substring(3)+']',
		text:'Hey there '+Name+',\n You have requested to register '+To+' in <Our Name>\nVerification code- '+otp+'\n\nThis is a system generated mail. Please do not reply to this mail.\nThanks'
	}
	var transporter=nodemailer.createTransport({
		service:'gmail',
		secure:false,
		port:25,
		auth:{
			user:'togetherconnect0@gmail.com',
			pass:'connect123!'
		},
		tls:{
			rejectUnauthorized:false
		}
	});

	transporter.sendMail(mailOptions,function(err,info){
		if(err)
		{
			console.log(err);
			throw err;
		}
		else
			console.log('Email sent '+info.response);
	});
	return otp;
}

//-----------------------------------------------------//

var getRandomString = function(length){
	return crypto.randomBytes(Math.ceil(length/2))
	.toString('hex')
	.slice(0,length);
}

var sha512 = function(password,salt){
	var hash = crypto.createHmac('sha512',salt);
	hash.update(password);
	var value = hash.digest('hex');
	return{
		salt:salt,
		passwordHash:value
	};
};

function saltHashPassword(userPassword){
	var salt = getRandomString(16);
	var passwordData = sha512(userPassword,salt);
	return passwordData;
	
}

function checkHashPassword(userPassword,salt){
	var passwordData = sha512(userPassword,salt);
	return passwordData;
}

function getSecuredPassword(plain_password)
{
		var hash_data = saltHashPassword(plain_password);
		var password=hash_data.passwordHash;
		var salt=hash_data.salt;
		return{
			salt:salt,
			password:password
		};
};

//Create Express Service
var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));

app.set('views', path.join(__dirname,'public'));
app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname,'public')));

app.use(express.urlencoded({extended: true}));
app.use(express.json());

app.use(session({
	secret: "aezakmihesoyam",
	resave: true,
	saveUninitialized: true
	}));

//Create MongoDB Client
var MongoClient = mongodb.MongoClient;

//Connection URL
//var url = 'mongodb://localhost:27017'; //27017 is default port

mongoose.connection.on('error',(err)=>{
	console.log("DB Connection Error");
});

var Schema = mongoose.Schema;

var userSchema = Schema({
	name: String,
	email: String,
	password: String,
	salt : String,
	verifiedOTP : String
});

var otpSchema = Schema({
	email : String,
	otp : String,
	salt : String
});

var schoolSchema = Schema({
	
	name: String,
	code: String,
	state : String,
	city : String,
	added_by : String,
	status : String,
	
	
});

var studentSchema = Schema({
	
	name : String,
	standard : String,
	roll_no : String,
	contact : String,
	school_code : String,
	admission_no : String,
	pic_id : String,
	added_by : String,
	status : String
	
	
});

var userdetails = mongoose.model('userDetails',userSchema,'usersdetails');
var otpdetails = mongoose.model('otpDetails',otpSchema,'otpdetails');
var schooldetails = mongoose.model('schoolDetails',schoolSchema,'schooldetails');
var studentdetails = mongoose.model('studentDetails',studentSchema,'studentdetails');

//----------------------App--------------------------//
//----------------------Register---------------------//

app.post('/registerUser',(req,res,next)=>{
			
		var data = req.body;
		var plain_password = data.password;
		var hash_data = saltHashPassword(plain_password);
		var password = hash_data.passwordHash;
		var salt = hash_data.salt;
		
		var name = data.name;
		var email = data.email;
		
		var insertJSON = {
				'email':email,
				'password':password,
				'salt':salt,
				'name':name
		}
		
		userdetails.find({'email':email}).count(function(err,number){
			if(err)
				console.log(err);
			else if(number!=0)
			{
				res.json('Email already exists');
				console.log('Email already exists');
			}
			else
			{
				
				var toReturn;
				
				var newUserDetails=new userdetails({
					name:name,
					email:email,
					salt:salt,
					password:password,
					verifiedOTP : '0'
				});
				
				newUserDetails.save()
				.then(savedData =>{
					toReturn+='Registration Successful';
				})
				
				/*userdetails
				.insert(insertJSON,function(err,data){
						res.json('Registration Successful');
						console.log('Registration Successful');
				})*/
				var otp = 0; 
				var otp=sendNewUserMail(data.email,data.name);
				
					var newOtpDetails=new otpdetails({
						email:email,
						otp:otp,
					});
					newOtpDetails.save()
					.then(savedData=>{
						toReturn+='\nOtp Saved';
					})
					res.json('Registration Successful');
					console.log('Registration Successful');
			}
		})
		
	});
//-------------------------------------------//
	
//----------------------Login---------------------//		

	
app.post('/loginUser',(req,res,next)=>{
	
	var data=req.body;
	
	var email=data.email;
	var userPassword=data.password;
	
	userdetails.find({email:email}).exec(function(err,updata){
		if(err)
			throw err;
		if(updata.length==0)
		{
			res.json('No User Found');
			console.log('No User Found');
		}
		else
		{
			var salt=updata[0].salt;
			//console.log(salt);
			//console.log(updata);
			var encrypted_password=updata[0].password;
			var hashed_password=checkHashPassword(userPassword,salt).passwordHash;
			//var hashed_password=encrypted_password
			if(hashed_password==encrypted_password)
			{
				req.session.isUserLogin=1;
				req.session.userName=updata[0].name;
				req.session.userEmail=email;
				
				if(data[0].verifiedOTP=='0')
				{
					res.json('Verify Your OTP')
				}
				else
				{	
					res.json('Login Successful');
					console.log('Login Successful');
				}
			}
			else
			{
				res.json('No User Found');
				console.log('No User Found');
			}
		}
	});
	
	//Check Email Exists
	/*userdetails
	.find({'email':email}).count(function(err,number){
		if(err)
			console.log(err);
		else if(number==0)
		{
			res.json('Email not exists');
			console.log('Email not exists');
		}
		else
		{
			
				userdetails
				.findOne({'email':email},function(err,user){
					var salt = user.salt;
					var hashed_password = checkHashPassword(userPassword,salt).passwordHash;
					var encrypted_password = user.password;
					if(hashed_password==encrypted_password)
					{
						res.json('Login Successful');
						console.log('Login Successful');
					}
					else
					{
						res.json('No User Found');
						console.log('No User Found');
					}
				})
		}
	})*/
	
});	
	
//-------------------------------------------//

//------------------Log Out---------------------//

app.post('/logout',function(req,res){

		req.session.destroy();
})

//----------------------------------------------//

//--------------------Check OTP---------------------

app.post('/verifyOtp',function(req,res){
	
	var body=req.body;
	var email=req.session.email;
	var otp=body.otp;
	
	otpdetails.find({email:email,otp:otp})
	.exec(function(err,data){
		if(err)
		{
			console.log(err);
			throw err;
		}
		else
		{
			if(data.length==0)
			{
				res.json('Wrong OTP');
				console.log('Wrong OTP');
			}
			else
			{
				userdetails.updateOne({email:email},{$set:{verifiedOTP:'1'}})
				.exec(function(err,data){
					if(err)
						throw err;
					else
					{
						otpdetails.deleteOne({email:email})
						.exec(function(err,data){
							if(err)
								throw err;
							else
							{
								res.json('OTP Verified');
								console.log('OTP Verified');
							}
						})
						
					}
				})
			}
		}
	})
	
});