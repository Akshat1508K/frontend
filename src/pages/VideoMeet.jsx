import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { Badge, IconButton, TextField, Button } from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ChatIcon from "@mui/icons-material/Chat";
import styles from "../styles/videoComponent.module.css";

const server_url = "https://backend-rh9i.vercel.app/";
var connections = {};
const peerConfigConnections = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

export default function VideoMeetComponent() {
    const socketRef = useRef();
    const socketIdRef = useRef();
    const localVideoref = useRef();
    const videoRef = useRef([]);

    const [videoAvailable, setVideoAvailable] = useState(true);
    const [audioAvailable, setAudioAvailable] = useState(true);
    const [video, setVideo] = useState(true);
    const [audio, setAudio] = useState(true);
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");
    const [newMessages, setNewMessages] = useState(0);
    const [askForUsername, setAskForUsername] = useState(true);
    const [username, setUsername] = useState("");
    const [videos, setVideos] = useState([]);
    const [userList, setUserList] = useState({});
    const [videoStatus, setVideoStatus] = useState({});

    useEffect(() => {
        console.log("je")
        getPermissions();
    }, []);


    useEffect(() => {
        // Attach stream to local video on every change
        if (localVideoref.current && window.localStream) {
            localVideoref.current.srcObject = window.localStream;
        }
    }, [video, audio]);





    // Get permissions and create user media stream
    const getPermissions = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720 },
                audio: true
            });
            window.localStream = stream;
            setVideoAvailable(true);
            setAudioAvailable(true);
            setVideo(true);
            setAudio(true);
            if (localVideoref.current) {
                localVideoref.current.srcObject = stream;
            }
        } catch (error) {
            setVideoAvailable(false);
            setAudioAvailable(false);
            setVideo(false);
            setAudio(false);
            alert("Please allow camera and microphone access to use this app");
        }
    };

    // Reacquire the camera and mic stream when needed
    const reacquireStream = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            window.localStream = stream;
            if (localVideoref.current) {
                localVideoref.current.srcObject = stream;
            }
            // Replace local tracks for all connections:
            Object.keys(connections).forEach((id) => {
                if (connections[id]) {
                    stream.getTracks().forEach(track => {
                        connections[id].addTrack(track, stream);
                    });
                }
            });
        } catch (error) {
            alert("Unable to re-acquire camera/mic. Try refreshing.");
        }
    };

    // Set up socket server and peer connections
    const connectToSocketServer = () => {
        if (!window.localStream) {
            alert("Camera not initialized. Please allow camera access.");
            return;
        }

        socketRef.current = io.connect(server_url);
        socketRef.current.on("signal", gotMessageFromServer);
        socketRef.current.on("connect", () => {
            socketIdRef.current = socketRef.current.id;
            socketRef.current.emit("join-call", window.location.href, username);

            socketRef.current.on("chat-message", addMessage);
            socketRef.current.on("user-left", (id) => {
                setVideos((vs) => vs.filter((video) => video.socketId !== id));
                if (connections[id]) {
                    connections[id].close();
                    delete connections[id];
                }
            });
            socketRef.current.on("video-toggled", handleVideoToggle);
            socketRef.current.on("user-joined", (id, clients, users, vStatus) => {
                setUserList(users);
                setVideoStatus(vStatus);

                clients.forEach((socketListId) => {
                    if (!connections[socketListId]) {
                        connections[socketListId] = new RTCPeerConnection(peerConfigConnections);

                        connections[socketListId].onicecandidate = (event) => {
                            if (event.candidate) {
                                socketRef.current.emit(
                                    "signal",
                                    socketListId,
                                    JSON.stringify({ ice: event.candidate })
                                );
                            }
                        };
                        connections[socketListId].ontrack = (event) => {
                            setVideos((vs) => [
                                ...vs.filter((v) => v.socketId !== socketListId),
                                { socketId: socketListId, stream: event.streams[0] }
                            ]);
                        };
                        // Add new tracks for all local streams
                        if (window.localStream) {
                            window.localStream.getTracks().forEach(track => {
                                connections[socketListId].addTrack(track, window.localStream);
                            });
                        }
                        if (id === socketRef.current.id) {
                            connections[socketListId].createOffer()
                                .then(offer => connections[socketListId].setLocalDescription(offer))
                                .then(() => {
                                    socketRef.current.emit(
                                        "signal",
                                        socketListId,
                                        JSON.stringify({ sdp: connections[socketListId].localDescription })
                                    );
                                })
                                .catch(console.error);
                        }
                    }
                });
            });
        });
    };

    const gotMessageFromServer = (fromId, message) => {
        const signal = JSON.parse(message);
        if (fromId !== socketIdRef.current) {
            if (signal.sdp) {
                connections[fromId]
                    .setRemoteDescription(new RTCSessionDescription(signal.sdp))
                    .then(() => {
                        if (signal.sdp.type === "offer") {
                            connections[fromId]
                                .createAnswer()
                                .then((description) => {
                                    connections[fromId]
                                        .setLocalDescription(description)
                                        .then(() => {
                                            socketRef.current.emit(
                                                "signal",
                                                fromId,
                                                JSON.stringify({
                                                    sdp: connections[fromId].localDescription,
                                                })
                                            );
                                        });
                                });
                        }
                    });
            }
            if (signal.ice)
                connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice));
        }
    };

    const addMessage = (payload) => {
        setMessages((prev) => [...prev, payload]);
        if (payload.socketIdSender && payload.socketIdSender !== socketIdRef.current) {
            setNewMessages((n) => n + 1);
        }
    };

    const sendMessage = () => {
        if (!message.trim()) return;
        if (socketRef.current) socketRef.current.emit("chat-message", message, username);
        setMessage("");
    };

    const handleVideoToggle = (id, isEnabled) => {
        setVideoStatus((prev) => ({ ...prev, [id]: isEnabled }));
    };

    const handleVideo = async () => {
        // If tracks have been stopped (e.g. after end call), reacquire
        if (!window.localStream || !window.localStream.getVideoTracks().length || window.localStream.getVideoTracks()[0].readyState === "ended") {
            await reacquireStream();
            setVideo(true);
        } else {
            // Toggle enabled proper way
            const newState = !video;
            setVideo(newState);
            window.localStream.getVideoTracks().forEach(track => {
                track.enabled = newState;
            });
        }
        if (socketRef.current) socketRef.current.emit("toggle-video", !video);
    };

    const handleAudio = async () => {
        if (!window.localStream || !window.localStream.getAudioTracks().length || window.localStream.getAudioTracks()[0].readyState === "ended") {
            await reacquireStream();
            setAudio(true);
        } else {
            const newState = !audio;
            setAudio(newState);
            window.localStream.getAudioTracks().forEach(track => {
                track.enabled = newState;
            });
        }
    };
    const handleCallEnd = () => {
        if (socketRef.current) socketRef.current.disconnect();
        Object.keys(connections).forEach(k => {
            try { connections[k].close(); } catch (e) {}
            delete connections[k];
        });
        if (window.localStream) {
            window.localStream.getTracks().forEach(t => {
                try { t.stop(); } catch (e) {}
            });
            window.localStream = null;
        }
        setVideos([]);
        setUserList({});
        setVideoStatus({});
        setAskForUsername(true);
        // **Important: reacquire camera for preview in join UI**
        getPermissions();  // <--- add this line
    };

    const connect = () => {
        if (!username.trim()) return;
        getPermissions();
        setTimeout(connectToSocketServer, 300); // ensures media is ready
        setAskForUsername(false);
    };

    return (
        <div>
            {askForUsername ? (
                <div style={{
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgb(1, 4, 48)',
                    color: 'white',
                    gap: '20px'
                }}>
                    <h2 style={{ marginBottom: '20px' }}>Join Meeting</h2>
                    <div style={{
                        width: '300px',
                        height: '200px',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        marginBottom: '20px',
                        background: '#000'
                    }}>
                        <video
                            ref={localVideoref}
                            autoPlay
                            muted
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                            }}
                        />
                    </div>
                    <TextField
                        id="outlined-basic"
                        label="Enter your name"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        variant="outlined"
                        sx={{
                            width: '300px',
                            '& .MuiOutlinedInput-root': {
                                color: 'white',
                                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.23)' },
                                '&:hover fieldset': { borderColor: 'white' }
                            },
                            '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' }
                        }}
                    />
                    <Button
                        variant="contained"
                        onClick={connect}
                        disabled={!username.trim()}
                        sx={{
                            width: '300px',
                            height: '48px',
                            marginTop: '10px',
                            fontSize: '16px'
                        }}
                    >
                        Join Meeting
                    </Button>
                </div>
            ) : (
                <div className={styles.meetVideoContainer}>
                    <div className={styles.chatRoom}>
                        <div className={styles.chatContainer}>
                            <h1>Chat</h1>
                            <div className={styles.chattingDisplay}>
                                {messages.length ? (
                                    messages.map((item, index) => (
                                        <div
                                            key={index}
                                            className={item.sender === username ? styles.chatBubbleRight : styles.chatBubbleLeft}
                                        >
                                            <div className={styles.chatMeta}>
                                                <span className={styles.nameTag} style={{
                                                    background: item.sender === username ? '#2a3a85' : '#51607a'
                                                }}>
                                                    {item.sender === username ? "You" : item.sender}
                                                </span>
                                                <span className={styles.timeTag}>
                                                    {new Date().toLocaleTimeString()}
                                                </span>
                                            </div>
                                            <div className={styles.chatText}>{item.data}</div>
                                        </div>
                                    ))
                                ) : (
                                    <p className={styles.noMessages}>No Messages Yet</p>
                                )}
                            </div>
                            <div className={styles.chattingArea}>
                                <TextField
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    id="outlined-basic"
                                    label="Enter Your chat"
                                    variant="outlined"
                                />
                                <Button variant="contained" onClick={sendMessage}>
                                    Send
                                </Button>
                            </div>
                        </div>
                    </div>
                    <div className={styles.buttonContainers}>
                        <IconButton
                            onClick={handleVideo}
                            style={{
                                color: video ? "white" : "red",
                                background: video ? "rgba(255,255,255,0.1)" : "rgba(255,0,0,0.1)",
                                margin: "0 8px"
                            }}
                        >
                            {video ? <VideocamIcon /> : <VideocamOffIcon />}
                        </IconButton>
                        <IconButton onClick={handleCallEnd} style={{ color: "red", margin: "0 8px" }}>
                            <CallEndIcon />
                        </IconButton>
                        <IconButton
                            onClick={handleAudio}
                            style={{
                                color: audio ? "white" : "red",
                                background: audio ? "rgba(255,255,255,0.1)" : "rgba(255,0,0,0.1)",
                                margin: "0 8px"
                            }}>
                            {audio ? <MicIcon /> : <MicOffIcon />}
                        </IconButton>
                        <Badge badgeContent={newMessages} color="warning">
                            <IconButton style={{
                                color: "white",
                                background: "rgba(255,255,255,0.1)",
                                margin: "0 8px"
                            }}>
                                <ChatIcon />
                            </IconButton>
                        </Badge>
                    </div>
                    <div className={styles.localVideoWrap}>
                        {video && window.localStream ? (
                            <video
                                className={styles.meetUserVideo}
                                ref={localVideoref}
                                autoPlay
                                muted
                                playsInline
                            ></video>
                        ) : (
                            <div className={styles.meetUserVideo} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexDirection: 'column',
                                background: '#1a1a1a'
                            }}>
                                <div style={{
                                    fontSize: '40px',
                                    marginBottom: '10px',
                                    color: '#666'
                                }}>
                                    👤
                                </div>
                                <div style={{ color: '#fff' }}>{username} (You)</div>
                            </div>
                        )}
                    </div>
                    <div className={videos.length === 1 ? styles.singleRemote : styles.conferenceView}>
                        {videos.map((v) => {
                            const isVideoEnabled = videoStatus[v.socketId];
                            const participantName = userList[v.socketId] || "User";
                            return (
                                <div
                                    className={styles.remoteTile}
                                    key={v.socketId}
                                    style={{
                                        width: videos.length === 1 ? '100%' : '300px',
                                        height: videos.length === 1 ? '100%' : '225px',
                                        position: 'relative',
                                        borderRadius: '12px',
                                        overflow: 'hidden',
                                        background: '#1a1a1a',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                    }}
                                >
                                    {isVideoEnabled && v.stream ? (
                                        <video
                                            ref={(ref) => {
                                                if (ref) {
                                                    ref.srcObject = v.stream;
                                                    ref.play().catch(() => {});
                                                }
                                            }}
                                            autoPlay
                                            playsInline
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover'
                                            }}
                                        />
                                    ) : (
                                        <div style={{
                                            width: '100%',
                                            height: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexDirection: 'column'
                                        }}>
                                            <div style={{
                                                fontSize: '40px',
                                                marginBottom: '10px',
                                                color: '#666'
                                            }}>
                                                👤
                                            </div>
                                            <div style={{ color: '#fff' }}>{participantName}</div>
                                        </div>
                                    )}
                                    <div className={styles.videoOverlayName}>
                                        {participantName}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
