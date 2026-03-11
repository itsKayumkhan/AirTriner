import jwt from 'jsonwebtoken';

const token = "eyJhbGciOiJFUzI1NiIsImtpZCI6ImIyM2RiYTg0LTk2YzctNDg4NC1iNzk5LTNkMWZhYmM5ZjI3YiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2R1YXFrbXB0eHNub252dGZkb2hwLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiIyYTlhZTIwOS0yZWJlLTQ4MzUtOTdlNS1mMzllYTgxODU4YjciLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzczMTQ3NjkwLCJpYXQiOjE3NzMxNDQwOTAsImVtYWlsIjoiYXNtaXRnYXdhbmRlMTMwN0BnbWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsIjoiYXNtaXRnYXdhbmRlMTMwN0BnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJzdWIiOiIyYTlhZTIwOS0yZWJlLTQ4MzUtOTdlNS1mMzllYTgxODU4YjcifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc3MzE0NDA5MH1dLCJzZXNzaW9uX2lkIjoiZDU2Y2QzY2EtNTliYi00NjRkLWI3OTMtOWJjYjRlYzE1NzgyIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.9esAGEPe7t_bpCqR9VVV5fiTBXzOUlrOnajVlcyPGrg6aSpIduPPwnC9whj-yXyDFeWplS61mVOVtrlWoBu91A";

try {
    const decoded = jwt.decode(token);
    console.log("Decoded:", decoded);
    console.log("Sub:", (decoded as any)?.sub);
    console.log("Email:", (decoded as any)?.email);
    console.log("User Role:", (decoded as any)?.user_role);
} catch (e) {
    console.error("Decode failed", e);
}
