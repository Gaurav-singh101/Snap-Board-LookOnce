const { Schema , model } = require("mongoose");

const blogSchema = new Schema({
    title:{
        type: String ,
        required: false ,
    } , 

    body:{
        type: String , 
        required : false ,
    } , 

    coverImageURL: {
        type: String , 
        required : false , 
    },

    createdBy: {
        type: Schema.Types.ObjectId , 
        ref: "user" , 
    } ,
  },
  {timestamps: true} 
);


const Blog = model('blog' , blogSchema) ; 

module.exports = Blog ;