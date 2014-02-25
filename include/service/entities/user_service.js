/**
 * UserService - Service for performing user specific operation.  
 *
 * @author Brian Hyder <brian@pencilblue.org>
 * @copyright PencilBlue 2014, All Rights Reserved
 */
function UserService(){}

UserService.prototype.getFullName = function(userId, cb) {
	var dao = new pb.DAO();
	dao.loadById(userId, 'user', function(err, author){
		if (util.isError(err)) {
			callback(err, null);
			return;
		}

		cb(null, author.first_name + ' ' + author.last_name);
	});
};

UserService.prototype.getAuthors = function(objArry, cb){
	var self  = this;
	var tasks = pb.utils.getTasks(objArry, function(objArry, index){
    	return function(callback) {
    		self.getFullName(objArry[index].author, function(err, fullName){
    			objArry[index].author_name = fullName;
    			callback(err, objArry[index]);
    		});
    	};
    });
    async.parallelLimit(tasks, 3, cb);
};

UserService.prototype.sendVerificationEmail = function(user, cb) {
	cb = cb || pb.utils.cb;
	
	var options = {
		to: user.email,
		subject: 'pencilblue Account Confirmation',
		template: 'admin/elements/default_verification_email',
		replacements: {
			'^verification_url^': pb.config.siteRoot + '/actions/user/verify_email?email=' + user.email + '&code=' + user.verification_code,
			'^first_name^': user.first_name,
			'^last_name^': user.last_name
		}
	};
	pb.sendFromTemplate(options, cb);
};

UserService.prototype.isUserNameOrEmailTaken = function(username, email, id, cb) {
	this.getExistingUsernameEmailCounts(username, email, id, function(err, results) {
		
		var result = results == null;console.log('results='+results+' error='+err);
		if (!result) {
			
			for(var key in results) {
				result |= results[key] > 0;console.log('key='+key+' val='+results[key]+' result='+result);
			}
		}
		cb(err, result);
	});
};

UserService.prototype.getExistingUsernameEmailCounts = function(username, email, id, cb) {
	var getWhere = function(where) {
		if (id) {console.log('adding id'+id);
			where._id = {$ne: new ObjectID(id)};
		}
	};
	var dao   = new pb.DAO();
	var tasks = {
		verified_username: function(callback) {console.log('verified_username:'+username);
			dao.count('user', getWhere({username: username}), callback);
		},
		verified_email: function(callback) {console.log('verified_email:'+email);
			dao.count('user', getWhere({email: email}), callback);
		},
		unverified_username: function(callback) {console.log('unverified_username:'+username);
			dao.count('unverified_user', getWhere({username: username}), callback);
		},
		unverified_email: function(callback) {console.log('unverified_email:'+email);
			dao.count('unverified_user', getWhere({email: email}), callback);
		},
	};
	async.series(tasks, cb);
};

//exports
module.exports.UserService = UserService;