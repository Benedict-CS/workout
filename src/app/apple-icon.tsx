import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#090a0f",
          borderRadius: "36px",
          border: "4px solid #10b981",
        }}
      >
        <span style={{ fontSize: "90px" }}>🏋️</span>
      </div>
    ),
    { ...size }
  );
}
