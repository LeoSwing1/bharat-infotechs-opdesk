export function opdeskEmailTemplate({
  title,
  message,
  actionText,
  actionUrl,
}: {
  title: string;
  message: string;
  actionText?: string;
  actionUrl?: string;
}) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OPDesk</title>
</head>

<body style="
  margin:0;
  padding:0;
  background:#f5f7fb;
  font-family:Arial,Helvetica,sans-serif;
  color:#111827;
">

  <div style="
    max-width:620px;
    margin:40px auto;
    background:#ffffff;
    border-radius:16px;
    overflow:hidden;
    border:1px solid #e5e7eb;
  ">

    <div style="
      background:#111827;
      padding:28px 32px;
      color:#ffffff;
    ">
      <div style="
        font-size:24px;
        font-weight:800;
      ">
        OPDesk
      </div>

      <div style="
        margin-top:5px;
        font-size:13px;
        color:#cbd5e1;
      ">
        Workforce Operations
      </div>
    </div>

    <div style="padding:32px">

      <h1 style="
        margin:0 0 16px;
        font-size:24px;
        line-height:1.3;
      ">
        ${title}
      </h1>

      <div style="
        font-size:15px;
        line-height:1.7;
        color:#475467;
      ">
        ${message}
      </div>

      ${
        actionText && actionUrl
          ? `
        <div style="margin-top:28px">
          <a
            href="${actionUrl}"
            style="
              display:inline-block;
              background:#111827;
              color:#ffffff;
              text-decoration:none;
              padding:12px 20px;
              border-radius:10px;
              font-weight:600;
            "
          >
            ${actionText}
          </a>
        </div>
      `
          : ""
      }

    </div>

    <div style="
      border-top:1px solid #e5e7eb;
      padding:20px 32px;
      font-size:12px;
      color:#98a2b3;
    ">
      This notification was sent by OPDesk.
    </div>

  </div>

</body>
</html>
`;
}