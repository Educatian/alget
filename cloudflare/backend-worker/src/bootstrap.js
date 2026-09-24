const headers = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

export default {
  fetch() {
    return new Response(
      JSON.stringify({
        status: "provisioning",
        message: "ALGET backend is being configured.",
      }),
      { status: 503, headers },
    );
  },
};
