async (maxResultChars) => {
  try {
    const value = await (async () => {
      /* __USER_CODE__ */
    })();

    let json;
    try {
      json = JSON.stringify(value);
    } catch (error) {
      json = String(value);
    }

    if (typeof json !== "string") {
      json = String(value);
    }

    const truncated = json.length > maxResultChars;

    return {
      ok: true,
      value: truncated ? json.slice(0, maxResultChars) : json,
      truncated,
    };
  } catch (error) {
    return {
      ok: false,
      error: error && error.message ? error.message : String(error),
    };
  }
}
