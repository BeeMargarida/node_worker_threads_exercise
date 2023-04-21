import { Worker } from "worker_threads";

interface Task<D, R> {
  runAsync(data: D): Promise<R>;
}

interface WorkerPool {
  createTask<D, R>(f: (d: D) => R): Task<D, R>;
}

interface WorkerPoolOptions {
  workers: number;
}

function createWorkerPool(options: WorkerPoolOptions): WorkerPool {
  const workers = new Map(
    Array.from({ length: options.workers }).map((
      n,
    ) => {
      const worker = new Worker("./dist/worker.js");
      return [worker.threadId, worker];
    }),
  );

  const idleWorkers = Array.from(workers.keys());
  const resolvers = new Map<number, (data: any) => void>();
  const backlog: { id: number, task: (data: any) => void, data: any }[] = [];
  let taskCounter = 0;

  function runNext() {
    // return early if there are no more space in the worker pool
    // or there is nothing more to be executed
    if (backlog.length === 0 || idleWorkers.length === 0) return;

    const task = backlog.shift();
    const workerId = idleWorkers.shift();

    if (!workerId || !task) return;

    const message = { ...task, task: task.task.toString() };
    workers.get(workerId)?.postMessage(message);

    // run the next task if possible
    runNext();
  }

  workers.forEach((worker, index) => {
    // pass the result of the execution to the resolver and
    // run the next steps with one more runner now 
    worker.on('message', (data) => {
      const { id, result } = data;
      resolvers.get(Number(id))?.(result);
      resolvers.delete(Number(id));
      idleWorkers.push(index);
      runNext();
    })
  })

  return {
    createTask<D, R>(f: (data: any) => void): Task<D, R> {
      return {
        runAsync<D, R>(data: D): Promise<R> {
          taskCounter++;
          backlog.push({ id: taskCounter, task: f, data });
          
          const promise = new Promise<R>(resolve => resolvers.set(taskCounter, resolve));
          runNext();

          return promise;
        }
      }
    }
  };
}


const pool = createWorkerPool({ workers: 5 });
const task = (n: number) => {
  const fibonacci = (n: number): number => (n < 2) ? n : fibonacci(n - 2) + fibonacci(n - 1);
  return fibonacci(n);
}
pool.createTask(task).runAsync(30).then(console.log);
pool.createTask(task).runAsync(10).then(console.log);
pool.createTask(task).runAsync(50).then(console.log);