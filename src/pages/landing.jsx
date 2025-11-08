import React from 'react';
import "../App.css";
import { Link, useNavigate } from 'react-router-dom';

export default function LandingPage() {
    const router = useNavigate();

    return (
        <div className='landingPageContainer'>
            <nav>
                <div className='navHeader' style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                    <h2
                        style={{
                            marginBottom: "2px",
                            fontWeight: "700",
                            letterSpacing: "1px",
                            color: "#ffffff",
                            textShadow: "0px 0px 8px rgba(155, 99, 255, 0.7)"
                        }}
                    >
                        NEXORA
                    </h2>
                    <p
                        style={{
                            fontStyle: "italic",
                            fontSize: "12px",
                            color: "#bdbdbd",
                            marginTop: "0px",
                            letterSpacing: "0.5px"
                        }}
                    >
                        Next + Aura → The next evolution of human connection.
                    </p>
                </div>

                <div className='navlist'>
                    <p onClick={() => router("/aljk23")}>Join as Guest</p>
                    <p onClick={() => router("/auth")}>Register</p>
                    <div onClick={() => router("/auth")} role='button'>
                        <p>Login</p>
                    </div>
                </div>
            </nav>

            <div className="landingMainContainer">
                <div>
                    <h1 style={{ fontSize: "2.8rem", fontWeight: "700" }}>
                        <span style={{ color: "#FF9839" }}>Connect</span> with your loved Ones
                    </h1>

                    <p
                        style={{
                            marginTop: "10px",
                            fontSize: "1.2rem",
                            color: "#d1d1d1",
                            fontStyle: "italic",
                            letterSpacing: "0.5px",
                            textShadow: "0px 0px 6px rgba(255, 255, 255, 0.2)",
                        }}
                    >
                        Here, distance does not matter 🌍
                    </p>

                    <div role='button' style={{ marginTop: "25px" }}>
                        <Link
                            to={"/auth"}
                            style={{
                                textDecoration: "none",
                                backgroundColor: "#FF9839",
                                color: "white",
                                fontWeight: "600",
                                padding: "10px 25px",
                                borderRadius: "8px",
                                boxShadow: "0px 0px 10px rgba(255, 152, 57, 0.6)",
                                transition: "all 0.3s ease-in-out"
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.backgroundColor = "#ffae5a";
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.backgroundColor = "#FF9839";
                            }}
                        >
                            Get Started
                        </Link>
                    </div>
                </div>

                <div>
                    <img
                        src="/mobile.png"
                        alt=""
                        style={{
                            maxWidth: "90%",
                            borderRadius: "20px",
                            filter: "drop-shadow(0px 0px 12px rgba(255, 255, 255, 0.1))"
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
