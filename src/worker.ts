import { parentPort } from "worker_threads";

parentPort?.on('message', (msg) => {
    const { id, task, data } = msg;
    console.log(`running task ${id} on thread ${id} with data ${data}`);

    const func = `(${task})`;
    const result = eval(func)(data);

    parentPort?.postMessage({ id, result });
})