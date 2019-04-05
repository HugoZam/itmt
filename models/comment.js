var mongoose = require("mongoose");

var commentSchema = mongoose.Schema({
    comment: String,
    user: String,
    filename : String
});

module.exports = mongoose.model("Comment", commentSchema);

