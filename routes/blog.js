const { Router } = require("express");
const multer  = require('multer')
const router = Router();
const path = require('path');
const fs = require('fs'); // Add this for file deletion

const Blog = require('../models/blog');
const Comment = require('../models/comment');


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, path.resolve(`./public/uploads/`));
    },
    filename: function (req, file, cb) {
        const fileName = `${Date.now()}-${file.originalname}` ;
        cb(null , fileName);
    },
});

const upload = multer({ storage: storage })



router.get('/add-new' , (req , res) => {
    return res.render("addBlog" , {
        user: req.user , 
    });
});

router.get("/:id" , async (req , res) => {
    const blog = await Blog.findById(req.params.id).populate("createdBy");
    const comments = await Comment.find({ blogId: req.params.id }).populate(
        "createdBy"
    );
    return res.render('blog' , {
        user: req.user , 
        blog , 
        comments ,
    });
});


router.post('/comment/:blogId' , async(req , res) =>{
    await Comment.create({
        content: req.body.content , 
        blogId: req.params.blogId , 
        createdBy: req.user._id , 
    });
    return res.redirect(`/blog/${req.params.blogId}`);
});

// DELETE ROUTE - Add this new route
router.delete('/:id', async (req, res) => {
    try {
        // Check if user is logged in
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Find the blog post
        const blog = await Blog.findById(req.params.id);
        
        if (!blog) {
            return res.status(404).json({ error: 'Blog post not found' });
        }

        // Check if the current user is the creator of the blog
        if (blog.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'You can only delete your own posts' });
        }

        // Delete associated comments first
        await Comment.deleteMany({ blogId: req.params.id });

        // Delete the cover image file if it exists
        if (blog.coverImageURL) {
            const imagePath = path.join(__dirname, '..', 'public', blog.coverImageURL);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        // Delete the blog post
        await Blog.findByIdAndDelete(req.params.id);

        res.status(200).json({ message: 'Blog deleted successfully' });
    } catch (error) {
        console.error('Error deleting blog:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/' , upload.single("coverImage") , async (req , res) => {
    const { title , body } = req.body
    const blog = await Blog.create({
        body,
        title , 
        createdBy: req.user._id , 
        coverImageURL: `/uploads/${req.file.filename}` ,
    });
    return res.redirect(`/blog/${blog._id}`);
});


module.exports = router ;