declare global {
  var $RPC: (id: number, functions: string[]) => Record<string, unknown>;
}

window.$RPC = (id: number, functions: string[]) => {
  return new Proxy(Object.create(null), {
    get(_target, fn) {
      if (functions.includes(fn as string)) {
        return (...args: any[]) => {
          return fetch(location.href, {
            method: "POST",
            body: JSON.stringify({ fn, args }),
            headers: {
              "x-rpc": "true",
              "x-rpc-id": id.toString(),
            },
          }).then(async res => {
            const { error, result } = await res.json();
            if (error) {
              throw new Error(error);
            }
            return result;
          });
        };
      }
      return undefined;
    },
  });
};
