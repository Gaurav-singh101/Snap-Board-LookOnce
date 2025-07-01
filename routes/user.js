const { Router } = require("express");
const User = require('../models/user');
const Blog = require('../models/blog');
const Comment = require('../models/comment');

const router = Router();

router.get('/signin' , (req , res) => {
    return res.render("signin");
});

router.get('/signup' , (req , res) => {
    return res.render("signup");
});

router.post('/signin' , async (req , res) => {
    const { email , password } = req.body ;

    try {  
        const token = await User.matchPasswordAndGenerateToken(email , password);
        return res.cookie("token" , token).redirect("/");
    }
    
    catch (error) {
        return res.render("signin" , {
            error: "Incorrect Email or password" ,
        });
    }
});

router.get("/logout" , (req , res) => {
    res.clearCookie("token").redirect("/");
})

router.post('/signup' , async (req , res) => {
    const { fullName , email , password } = req.body ;

    await User.create({
        fullName , 
        email , 
        password ,
    });

    return res.redirect("/");
});

// CORRECTED Profile route
router.get('/profile', async (req, res) => {
    if (!req.user) {
        return res.redirect('/user/signin');
    }
    
    try {
        // Get user statistics and recent posts in parallel
        const [totalPosts, totalComments, recentPosts] = await Promise.all([
            // Count total posts created BY this user
            Blog.countDocuments({ createdBy: req.user._id }),
            
            // Count total comments made BY this user (not on their posts)
            Comment.countDocuments({ createdBy: req.user._id }),
            
            // Get recent posts (last 5) created BY this user
            Blog.find({ createdBy: req.user._id })
                .sort({ createdAt: -1 })
                .limit(5)
                .populate('createdBy', 'fullName email')
        ]);
        
        // Add user join date if not exists - handle both plain objects and Mongoose documents
        const userData = {
            ...(req.user.toObject ? req.user.toObject() : req.user),
            joinedDate: req.user.createdAt || new Date()
        };
        
        return res.render('profile', {
            user: userData,
            totalPosts,           // This matches your template
            totalComments,        // This matches your template  
            recentPosts          // This matches your template
        });
    } catch (error) {
        console.error('Error loading profile:', error);
        return res.render('profile', {
            user: req.user,
            totalPosts: 0,
            totalComments: 0,
            recentPosts: [],
            error: 'Failed to load profile data'
        });
    }
});

// Edit profile page
router.get('/edit-profile', (req, res) => {
    if (!req.user) {
        return res.redirect('/user/signin');
    }
    
    return res.render('edit-profile', {
        user: req.user
    });
});

// Update profile
router.post('/edit-profile', async (req, res) => {
    if (!req.user) {
        return res.redirect('/user/signin');
    }
    
    try {
        const { fullName, email, bio, profilePicture } = req.body;
        
        // Update user data
        await User.findByIdAndUpdate(req.user._id, {
            fullName: fullName || req.user.fullName,
            email: email || req.user.email,
            bio: bio,
            profilePicture: profilePicture
        });
        
        return res.redirect('/user/profile');
    } catch (error) {
        console.error('Error updating profile:', error);
        return res.render('edit-profile', {
            user: req.user,
            error: 'Failed to update profile'
        });
    }
});

// Get user's all posts (separate page)
router.get('/my-posts', async (req, res) => {
    if (!req.user) {
        return res.redirect('/user/signin');
    }
    
    try {
        // Get posts with pagination
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        
        const userPosts = await Blog.find({ createdBy: req.user._id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('createdBy', 'fullName email');
        
        const totalPosts = await Blog.countDocuments({ createdBy: req.user._id });
        const totalPages = Math.ceil(totalPosts / limit);
        
        return res.render('my-posts', {
            user: req.user,
            posts: userPosts,
            currentPage: page,
            totalPages: totalPages,
            totalPosts: totalPosts
        });
    } catch (error) {
        console.error('Error loading user posts:', error);
        return res.redirect('/user/profile');
    }
});

// Delete post route
router.delete('/delete-post/:id', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const postId = req.params.id;
        
        // Find the post and check ownership
        const post = await Blog.findById(postId);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        // Check if user owns the post
        if (post.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'You can only delete your own posts' });
        }
        
        // Delete associated comments first
        await Comment.deleteMany({ blogId: postId });
        
        // Delete the post
        await Blog.findByIdAndDelete(postId);
        
        return res.status(200).json({ message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Error deleting post:', error);
        return res.status(500).json({ error: 'Failed to delete post' });
    }
});

// CORRECTED API stats endpoint
router.get('/api/stats', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const [totalPosts, totalComments] = await Promise.all([
            Blog.countDocuments({ createdBy: req.user._id }),
            Comment.countDocuments({ createdBy: req.user._id })
        ]);
        
        return res.json({
            totalPosts,
            totalComments,
            joinYear: new Date(req.user.createdAt).getFullYear()
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        return res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

module.exports = router;