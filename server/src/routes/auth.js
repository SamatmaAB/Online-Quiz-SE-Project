import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import User from "../models/User.js";
import { requireAuth, cookieOptions } from "../middleware/auth.js";
import { validateLogin, validateRegistration } from "../utils/validation.js";
const router=Router();
const limiter=rateLimit({windowMs:900000,limit:20,standardHeaders:"draft-7",legacyHeaders:false,message:{message:"Too many authentication attempts. Try again in 15 minutes."}});
function session(res,user){const token=jwt.sign({role:user.role},process.env.JWT_SECRET,{subject:user.id,expiresIn:"1d",issuer:"online-quiz-api"});res.cookie("quiz_session",token,cookieOptions());}
function safeUser(user){return {id:user.id,name:user.name,email:user.email,role:user.role};}
// Issue #3: registration with validation and password hashing.
router.post("/register",limiter,async(req,res,next)=>{try{
 const v=validateRegistration(req.body); if(!v.valid)return res.status(400).json({message:"Please correct the highlighted fields.",errors:v.errors});
 if(await User.findOne({email:v.cleanEmail}).lean())return res.status(409).json({message:"An account with this email already exists."});
 const user=await User.create({name:v.cleanName,email:v.cleanEmail,passwordHash:await bcrypt.hash(req.body.password,12)}); session(res,user);
 return res.status(201).json({message:"Account created successfully.",user:safeUser(user)});
 }catch(e){if(e?.code===11000)return res.status(409).json({message:"An account with this email already exists."});return next(e);}});
// Issue #4: login with a generic credential error to avoid account enumeration.
router.post("/login",limiter,async(req,res,next)=>{try{
 const v=validateLogin(req.body);if(!v.valid)return res.status(400).json({message:"Enter a valid email and password.",errors:v.errors});
 const user=await User.findOne({email:v.cleanEmail}).select("+passwordHash");const ok=user?await bcrypt.compare(req.body.password,user.passwordHash):false;
 if(!ok)return res.status(401).json({message:"Invalid email or password."});session(res,user);return res.json({message:"Logged in successfully.",user:safeUser(user)});
 }catch(e){return next(e);}});
router.post("/logout",(_req,res)=>{res.clearCookie("quiz_session",{...cookieOptions(),maxAge:undefined});res.json({message:"Logged out successfully."});});
router.get("/me",requireAuth,async(req,res,next)=>{try{const user=await User.findById(req.user.id);if(!user){res.clearCookie("quiz_session",{...cookieOptions(),maxAge:undefined});return res.status(401).json({message:"Account no longer exists."});}return res.json({user:safeUser(user)});}catch(e){return next(e);}});
export default router;
