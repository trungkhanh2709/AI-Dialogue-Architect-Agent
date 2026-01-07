//meetingpage.jsx
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
// import "../styles/meeting.css";
import ChatUI from "../component/ChatUI";
import SaveConfirmPopup from "../component/SaveConfirmPopup";

export default function Meeting({
  meetingData,
  onBack,
  cookieUserName,
  onExpire,
}) {
  const [currentSpeech, setCurrentSpeech] = useState({});
  const [meetingLog, setMeetingLog] = useState([]);
  const [lastFinalizedWords, setLastFinalizedWords] = useState({});
  const liveRef = useRef(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [speakingUsers, setSpeakingUsers] = useState({});
  const [chatHistory, setChatHistory] = useState([]);
  const [chatMessages, setChatMessages] = useState([
    {
      speaker: "Agent",
      text:
        "Hello, I’m your AI Sales Assistant. I can help you interact with your customers more effectively.",
      isAgent: true,
      isTemp: false,
    },
  ]);
  const [agentTyping, setAgentTyping] = useState(false);
  const transcriptIdRef = useRef(null);

  const decodedCookieEmail = decodeURIComponent(cookieUserName);
  const [showSavePopup, setShowSavePopup] = useState(false);
  const [currentTranscriptId, setCurrentTranscriptId] = useState(
    // nếu meetingData đã có transcript – ví dụ bạn cho phép chọn session cũ thì gắn vào đây
    null
  );

  const [uiTimer, setUiTimer] = useState({ minutes: 0, seconds: 0 });

  const reqIdRef = useRef(0);
  function isMySpeech(speaker) {
    return speaker === "You" || speaker === "Bạn";
  }

  useEffect(() => {
    if (liveRef.current) {
      liveRef.current.scrollTop = liveRef.current.scrollHeight;
    }
  }, [currentSpeech]);

  useEffect(() => {
    if (sessionExpired) {
      onExpire(); // báo cho App.jsx đổi sang upgrade
    }
  }, [sessionExpired, onExpire]);

  const saveOrUpdateMeeting = (logData) => {
    const autoSaveEnabled = localStorage.getItem("autoSaveEnabled") === "true";
    if (!autoSaveEnabled) return;

    const transcriptText = Array.isArray(logData)
      ? logData.join("\n")
      : meetingLog.join("\n");

    if (!transcriptText || transcriptText.trim().length === 0) {
      return;
    }

    const meetingId = meetingData._id || meetingData.id;
    if (!meetingId) {
      console.error("Missing meetingId (need meeting to exist before transcript)");
      return;
    }

    chrome.runtime.sendMessage(
      {
        type: "SAVE_MEETING_TRANSCRIPT",
        payload: {
          email: decodedCookieEmail,
          meetingId,
          transcriptText,
          // 🔥 truyền đúng transcriptId hiện tại (nếu đã có)
          transcriptId: transcriptIdRef.current,
        },
      },
      (res) => {
        console.log("[SAVE_MEETING_TRANSCRIPT] response:", res);
        if (res?.error) {
          console.error("Save transcript failed:", res.error);
        } else {
          const tIdFromBE = res?.data?.transcript_id;
          // Lần đầu BE tạo mới -> FE lưu lại để lần sau update
          if (tIdFromBE && !transcriptIdRef.current) {
            transcriptIdRef.current = tIdFromBE;
            console.log("[TRANSCRIPT] set current transcriptId =", tIdFromBE);
          }
        }
      }
    );
  };



  const meetingLogRef = useRef(meetingLog);
  useEffect(() => {
    meetingLogRef.current = meetingLog;
  }, [meetingLog]);


  useEffect(() => {
    // reset log + ref
    setMeetingLog([]);
    meetingLogRef.current = [];

    // reset live speech
    setCurrentSpeech({});
    setLastFinalizedWords({});
    setSpeakingUsers({});

    // reset transcript hiện tại (để tạo transcript mới cho session mới)
    transcriptIdRef.current = null;

    // (optional) reset chatMessages về mặc định nếu muốn
    setChatMessages([
      {
        speaker: "Agent",
        text:
          "Hello, I’m your AI Sales Assistant. I can help you interact with your customers more effectively.",
        isAgent: true,
        isTemp: false,
      },
    ]);

    setSessionExpired(false);
  }, [meetingData?._id, meetingData?.id]);

  // Listener chrome message
  useEffect(() => {
    const handleMessage = (message) => {
      if (message.type === "SESSION_EXPIRED") {
        const autoSaveEnabled =
          localStorage.getItem("autoSaveEnabled") === "true";

        if (autoSaveEnabled) {
          saveOrUpdateMeeting(meetingLogRef.current); // tự động lưu/update
          onExpire(); // chuyển sang upgrade
        } else {
          setShowSavePopup(true); // hiện popup
        }

        setSessionExpired(true);
        return;
      }
      if (message.type === "AGENT_FILLER") {
        const { text } = message.payload || {};
        if (!text) return;

        setChatMessages((prev) => {
          const msgs = [...prev];

          const fillerMsg = {
            speaker: "Agent",
            text,
            isAgent: true,
            isTemp: false,
            isFiller: true,
          };

          // tìm bubble agent đang stream gần nhất (isTemp = true, isAgent = true)
          let insertIndex = -1;
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].isAgent && msgs[i].isTemp) {
              insertIndex = i;
              break;
            }
          }

          if (insertIndex >= 0) {
            // chèn filler đứng TRÊN bubble agent đang stream
            msgs.splice(insertIndex, 0, fillerMsg);
          } else {
            // không tìm được agent stream thì fallback: append như cũ
            msgs.push(fillerMsg);
          }

          return msgs;
        });

        return;
      }


      if (message.type === "AGENT_STREAM_START") {
        // optional: có thể set trạng thái gì đó

        return;
      }

      if (message.type === "AGENT_STREAM_CHUNK") {
        const { delta, requestId } = message.payload || {};
        if (!delta) return;

        setChatMessages((prev) => {
          const m = [...prev];
          for (let i = m.length - 1; i >= 0; i--) {
            if (m[i].isAgent && m[i].isTemp && m[i].requestId === requestId) {
              m[i] = {
                ...m[i],
                text: (m[i].text || "") + delta,
              };
              break;
            }
          }
          return m;
        });
        return;
      }
      if (message.type === "AGENT_STREAM_DONE") {
        const { requestId } = message.payload || {};
        setAgentTyping(false);
        setChatMessages((prev) => {
          const newArr = [...prev];
          for (let i = newArr.length - 1; i >= 0; i--) {
            if (
              newArr[i].isAgent &&
              newArr[i].isTemp &&
              newArr[i].requestId === requestId
            ) {
              newArr[i] = {
                ...newArr[i],
                isTemp: false,
              };
              break;
            }
          }
          return newArr;
        });
        return;
      }

      if (message.type === "AGENT_STREAM_ERROR") {
        const { error, requestId } = message.payload || {};
        console.error("Agent stream error:", error);
        setAgentTyping(false);
        setChatMessages((prev) => {
          const newArr = [...prev];
          for (let i = newArr.length - 1; i >= 0; i--) {
            if (
              newArr[i].isAgent &&
              newArr[i].isTemp &&
              newArr[i].requestId === requestId
            ) {
              newArr[i] = {
                ...newArr[i],
                text: "Agent is unable to respond 😢",
                isTemp: false,
              };
              break;
            }
          }
          return newArr;
        });
        return;
      }

      // ====== END STREAM ======
if (message.type === "TIMER_UPDATE") {
  const { minutes, seconds } = message.payload || {};
  setUiTimer({
    minutes: Number(minutes || 0),
    seconds: Number(seconds || 0),
  });
  return;
}
      if (message.type !== "LIVE_TRANSCRIPT") return;

      const {
        action,
        speaker,
        finalized,
        currentSpeech: liveSpeech,
      } = message.payload;

      // --- Update live speech ---
      if (action === "update_live" && liveSpeech) {
        setCurrentSpeech((prev) => {
          const updated = { ...prev };
          Object.entries(liveSpeech).forEach(([spk, text]) => {
            const deltaText = getDeltaText(spk, text);
            if (deltaText) updated[spk] = deltaText;

            if (!isMySpeech(spk)) {
              setSpeakingUsers((prev) => ({ ...prev, [spk]: true }));
            }
          });
          return updated;
        });
      }

      // --- Handle finalize ---
      if (action === "finalize" && finalized) {
        setMeetingLog((prev) => {
          const newLogEntry = `${speaker}: "${finalized}"`;
          if (prev.includes(newLogEntry)) return prev;

          const updatedLog = [...prev, newLogEntry];

          const autoSaveEnabled =
            localStorage.getItem("autoSaveEnabled") === "true";
          if (autoSaveEnabled) {
            saveOrUpdateMeeting(updatedLog);
          }

          if (!sessionExpired && !isMySpeech(speaker)) {
            // UI: show user message ngay lập tức
            setChatMessages((prevMsgs) => [
              ...prevMsgs,
              { speaker, text: finalized },
            ]);
            setSpeakingUsers((prev) => ({ ...prev, [speaker]: false }));

            // 🔥 GỌI SONG SONG 2 API
            // const p1 = sendFillerRequest(updatedLog);
            const p2 = sendMessageToAgent({ speaker, text: finalized }, updatedLog);

            // Promise.allSettled([p1, p2]).then((results) => {
            //   console.log("Filler + Agent done:", results);
            // });

            //tạm tắt filler
            p2?.then((res) => console.log("Agent done:", res)).catch(console.error);

          }

          return updatedLog;
        });

        setCurrentSpeech((prev) => {
          const updated = { ...prev };
          delete updated[speaker];
          return updated;
        });

        setLastFinalizedWords((prev) => ({
          ...prev,
          [speaker]: [...(prev[speaker] || []), ...finalized.split(/\s+/)],
        }));
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [sessionExpired]);

  useEffect(() => {
    const finder = setInterval(() => {
      const container = document.querySelector("div.nMcdL.bj4p3b")
        ?.parentElement?.parentElement;
      if (container) {
        initObserver(container);
        clearInterval(finder);
      }
    }, 300);

    return () => clearInterval(finder);
  }, []);

  useEffect(() => {
    if (liveRef.current) {
      liveRef.current.scrollTop = liveRef.current.scrollHeight;
    }
  }, [currentSpeech, meetingLog]);

  // const sendFillerRequest = (log) => {
  //   if (sessionExpired) return Promise.resolve(null);

  //   return new Promise((resolve, reject) => {
  //     chrome.runtime.sendMessage(
  //       {
  //         type: "SEND_FILLER_REQUEST",
  //         payload: {
  //           meetingData,
  //           log,
  //         },
  //       },
  //       (res) => {
  //         if (chrome.runtime.lastError) {
  //           console.error("Filler runtime error:", chrome.runtime.lastError);
  //           reject(chrome.runtime.lastError);
  //           return;
  //         }

  //         if (res?.error) {
  //           console.error("Filler request failed:", res.error);
  //           reject(res.error);
  //         } else {
  //           console.log("Filler request ok:", res);
  //           resolve(res);
  //         }
  //       }
  //     );
  //   });
  // };
const getTimerFromBG = () =>
  new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_TIMER" }, (res) => {
      if (chrome.runtime.lastError) {
        resolve({ minutes: 0, seconds: 0 });
        return;
      }
      resolve({
        minutes: Number(res?.minutes || 0),
        seconds: Number(res?.seconds || 0),
      });
    });
  });


  const sendMessageToAgent = (newMessage, log) => {
    if (sessionExpired) return Promise.resolve(null);

    const requestId = ++reqIdRef.current;

    setChatMessages((prev) => [
      ...prev,
      {
        speaker: "Agent",
        text: "",
        isAgent: true,
        isTemp: true,
        requestId,
      },
    ]);

    setAgentTyping(true);

    return new Promise( async(resolve, reject) => {
      const timerNow = await getTimerFromBG();
      chrome.runtime.sendMessage(
        {
          type: "SEND_MESSAGE_TO_AGENT",
          // type: "SEND_MESSAGE_TO_AGENT_STREAM",
          payload: {
            meetingData,
            chatHistory,
            log,
            requestId,
            finalizedMessage: newMessage,
uiTimer: timerNow,         
 },
        },
        (res) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Agent stream start runtime error:",
              chrome.runtime.lastError
            );
            setChatMessages((prev) =>
              prev.map((msg) =>
                msg.isTemp && msg.isAgent && msg.requestId === requestId
                  ? {
                    ...msg,
                    text: "Agent is unable to respond 😢",
                    isTemp: false,
                  }
                  : msg
              )
            );
            setAgentTyping(false);
            reject(chrome.runtime.lastError);
            return;
          }

          if (res?.error || res?.ok === false) {
            console.error("Agent stream start failed:", res?.error);
            setChatMessages((prev) =>
              prev.map((msg) =>
                msg.isTemp && msg.isAgent && msg.requestId === requestId
                  ? {
                    ...msg,
                    text: "Agent is unable to respond 😢",
                    isTemp: false,
                  }
                  : msg
              )
            );
            setAgentTyping(false);
            reject(res?.error || "Agent stream start failed");
          } else {
            // ✅ lấy content từ response
            const content =
              res?.data?.content ??
              res?.data?.data?.content ??
              res?.data?.text ??
              "";

            // ✅ update bubble temp: set text + tắt isTemp
            setChatMessages((prev) =>
              prev.map((m) =>
                m.isAgent && m.isTemp && m.requestId === requestId
                  ? {
                    ...m,
                    text: String(content || "").trim()
                      ? String(content)
                      : "Agent returned empty content 😢",
                    isTemp: false,
                  }
                  : m
              )
            );

            setAgentTyping(false);
            resolve(res);
          }

        }
      );
    });
  };


  const handleClose = () => {
    const autoSaveEnabled = localStorage.getItem("autoSaveEnabled") === "true";
    const alreadyConfirmed = localStorage.getItem("saveConfirmed") === "true";

    const hasMeetingId = Boolean(meetingData._id || meetingData.id);

    if (autoSaveEnabled) {
      // ✅ Mode auto-save:
      // - Nếu meeting đã có ID: finalize đã tự gọi saveOrUpdateMeeting => KHÔNG save nữa để tránh duplicate
      // - Chỉ cần đóng UI
      if (hasMeetingId) {
        onBack();
        return;
      }

      // ❗ Trường hợp hiếm: autoSaveEnabled=true nhưng meeting chưa có ID
      // => vẫn dùng logic cũ để tạo block mới 1 lần
      if (!hasMeetingId) {
        // Hiển thị ngay trạng thái đóng popup / quay lại
        onBack();

        // Tạo block mới bất đồng bộ
        const newBlockPayload = {
          ...meetingData,
          blockName: meetingData.title || "Untitled Meeting",
          // Ở schema mới meeting_transcript là array => bạn có thể
          // quyết định có tạo transcript đầu tiên ở đây hay không.
          // Nếu KHÔNG muốn, có thể bỏ field này đi.
          meeting_transcript: meetingLog.join("\n"),
          createdAt: new Date().toISOString(),
        };

        chrome.runtime.sendMessage(
          {
            type: "CREATE_MEETING_PREPARE",
            payload: { email: decodedCookieEmail, payload: newBlockPayload },
          },
          (res) => {
            if (res?.error) console.error("Create block failed:", res.error);
            else console.log("Created new block with transcript:", res.data);
          }
        );

        return;
      }
    }

    // 🔻 Đến đây là autoSaveEnabled === false
    // => không auto save trong quá trình meeting
    // => khi close mới hỏi popup có save không

    setShowSavePopup(true);
  };


  const saveMeetingData = () => {
    const meetingId = meetingData._id?._id || meetingData._id || meetingData.id;
    if (!meetingId) {
      console.error("Missing meetingId in meetingData", meetingData);
      return;
    }

    const transcriptText = meetingLog.join("\n");
    if (!transcriptText || transcriptText.trim().length === 0) {
      return;
    }

    chrome.runtime.sendMessage(
      {
        type: "SAVE_MEETING_TRANSCRIPT",
        payload: {
          email: decodedCookieEmail,
          meetingId,
          transcriptText,
          transcriptId: transcriptIdRef.current,
        },
      },
      (res) => {
        if (res?.error) {
          console.error("Save failed:", res.error);
        } else {
          console.log("Meeting saved with transcript", res.data);
          const tIdFromBE = res?.data?.transcript_id;
          if (tIdFromBE && !transcriptIdRef.current) {
            transcriptIdRef.current = tIdFromBE;
          }
        }
      }
    );
  };



  const handleConfirmSave = () => {
    saveMeetingData();
    localStorage.setItem("saveConfirmed", "true");
    localStorage.setItem("autoSaveEnabled", "true"); // bật switch
    setShowSavePopup(false);
    onBack();
  };

  const handleCancelSave = () => {
    localStorage.setItem("saveConfirmed", "false");
    localStorage.setItem("autoSaveEnabled", "false"); // tắt switch
    setShowSavePopup(false);
    onBack();
  };

  // // //nhớ lên prodS thì xoá

  return (
    <div className="meeting-wrapper">
      {/* Delete duplicate rendering */}
      <div className="meeting-log-container">
        {meetingLog.map((log, i) => (
          <div key={i}>{log}</div>
        ))}
      </div>

      <div ref={liveRef}>
        {Object.entries(currentSpeech).map(([speaker, text]) => {
          const deltaText = getDeltaText(speaker, text);
          return deltaText ? (
            <div key={speaker}>
              <b>{speaker}:</b> {deltaText}
            </div>
          ) : null;
        })}
      </div>
<button
  onClick={() => {
    const ts = new Date().toISOString();
    console.groupCollapsed(`[UI][REFRESH_CAPTION_DOM ${ts}] click`);

    console.log("Sending REFRESH_CAPTION_DOM to content script…");

    chrome.runtime.sendMessage({ type: "REFRESH_CAPTION_DOM" }, (res) => {
      if (chrome.runtime.lastError) {
        console.error(
          "[UI] runtime.lastError:",
          chrome.runtime.lastError.message
        );
        alert(
          "⚠️ Không thể kết nối content script.\nHãy reload tab Google Meet."
        );
        console.groupEnd();
        return;
      }

      console.log("[UI] response:", res);

      if (!res?.ok) {
        console.warn("[UI] Refresh failed reason:", res?.error);

        alert(
          "⚠️ Không thể đọc caption Google Meet.\n\n" +
            "Chi tiết:\n" +
            (res?.error || "Unknown error") +
            "\n\nGợi ý:\n• Bật Captions trong Google Meet\n• Thử reload trang Meet"
        );
      } else {
        console.log(
          `[UI] Refresh success. blocks=${res.count}, okNodeCount=${res.okNodeCount}`
        );
      }

      console.groupEnd();
    });

    console.log("REFRESH_CAPTION_DOM request sent");
  }}
>
  🔄 Refresh captions
</button>


      {/* <ChatUI messages={sampleMessages} /> */}
      <ChatUI
        messages={chatMessages}
        onClose={handleClose}
        sessionExpired={sessionExpired}
        setSessionExpired={setSessionExpired}
        userEmail={decodedCookieEmail}
      />

      {showSavePopup && (
        <SaveConfirmPopup
          onConfirm={handleConfirmSave}
          onCancel={handleCancelSave}
        />
      )}
    </div>
  );
}
