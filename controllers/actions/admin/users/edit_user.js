/**
 * EditUser - Edits a user
 * 
 * @author Blake Callens <blake@pencilblue.org>
 * @copyright PencilBlue 2014, All rights reserved
 */
function EditUser(){}

//inheritance
util.inherits(EditUser, pb.FormController);

EditUser.prototype.onPostParamsRetrieved = function(post, cb) {console.log('edit post')
	var self = this;
	var get  = this.query;
	
	pb.utils.merge(get, post);
    
    post['photo'] = post['uploaded_image'];
    delete post['uploaded_image'];
    delete post['image_url'];
    
    var message = this.hasRequiredParams(post, this.getRequiredFields());
    if(message) {
        this.formError(message, '/admin/users/manage_users', cb);
        return;
    }

    
    if(!pb.security.isAuthorized(this.session, {admin_level: post['admin']})) {
        this.formError(request, session, '^loc_INSUFFICIENT_CREDENTIALS^', '/admin/users/manage_users', cb);
        return;
    }
    
    var dao = new pb.DAO();
    dao.loadById(post.id, 'user', function(err, user) {
        if(util.isError(err) || user == null) {
            self.formError('^loc_ERROR_SAVING^', '/admin/users/manage_users', cb);
            return;
        }
        
        pb.DocumentCreator.update(post, user);
        
        pb.users.isUserNameOrEmailTaken(user.username, user.email, post.id, function(err, isTaken) {
            if(util.isError(err) || isTaken) {
                self.formError('^loc_EXISTING_USERNAME^', '/admin/users/edit_user?id=' + get.id, cb);console.log('here');
                return;
            }
            
            dao.update(user).then(function(result) {
                if(util.isError(result)) {
                    self.formError('^loc_ERROR_SAVING^', '/admin/users/edit_user?id=' + get.id, cb);console.log('here2');
                    return;
                }
                
                self.session.success = '^loc_USER_EDITED^';
                self.redirect(pb.config.siteRoot + '/admin/users/manage_users', cb);
            });
        });
    });
};

EditUser.prototype.getRequiredFields = function() {
	return ['username', 'email', 'admin', 'id'];
};

//exports
module.exports = EditUser;
