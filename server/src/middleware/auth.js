import jwt from "jsonwebtoken";
export function cookieOptions() { return { httpOnly:true, secure:process.env.NODE_ENV === "production", sameSite:"lax", path:"/", maxAge:86400000 }; }
export function requireAuth(req,res,next) {
  const token=req.cookies?.quiz_session;
  if (!token) return res.status(401).json({message:"Please log in to continue."});
  try { const p=jwt.verify(token,process.env.JWT_SECRET); req.user={id:p.sub,role:p.role}; return next(); }
  catch { res.clearCookie("quiz_session",{...cookieOptions(),maxAge:undefined}); return res.status(401).json({message:"Your session has expired. Please log in again."}); }
}
