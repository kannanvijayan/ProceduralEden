import { EventEmitter } from "events";
import {
  isMessageObject,
  parseProtocolObject
} from "../utility/type-validation";
import {
  PROTOCOL_CONSTS,
} from "../constants";
import {
  ProtocolEnvelopeId,
  ProtocolObject,
  ProtocolRequestEnvelope,
  ProtocolRequestName,
  ProtocolRequestParams,
  ProtocolResponseType,
  ProtocolResponseValidator,
  ProtocolSpec,
  ProtocolTransport
} from "./types";

export interface ProtocolClient<P extends ProtocolSpec> {
  on(event: "error", cb: (err: Error) => void): this;
}

/**
 * A protocol server that uses an underlying transport.
 */
export class ProtocolClient<P extends ProtocolSpec>
  extends EventEmitter
  implements ProtocolClient<P>
{
  private readonly transport: ProtocolTransport;
  private readonly validator: ProtocolResponseValidator<P>;
  private readonly activeRequests: Map<ProtocolEnvelopeId, ResponseAcceptor> =
      new Map();
  private nextRequestId: number = PROTOCOL_CONSTS.requestIdMod;

  constructor(opts: {
    transport: ProtocolTransport,
    validator: ProtocolResponseValidator<P>,
  }) {
    super();
    const { transport, validator } = opts;
    this.transport = transport;
    this.validator = validator;
    transport.onMessage(this.processMessage.bind(this));
  }

  public sendRequest<RN extends ProtocolRequestName<P>>(
    name: RN,
    params: ProtocolRequestParams<P, RN>,
  ): Promise<ProtocolResponseType<P, RN>> {
    // Construct the request envelope.
    const id = this.nextRequestId;
    this.nextRequestId += PROTOCOL_CONSTS.messageIdIncr;
    const request: ProtocolRequestEnvelope = {
      type: "request",
      name,
      id,
      params,
    };

    // Make an acceptor to asynchronously handle the result.
    let acceptor: ResponseAcceptor;
    const resultPromise = new Promise((resolve, reject) => {
      acceptor = { name, resolve, reject };
      this.activeRequests.set(id, acceptor);
    });

    // Send the message.
    this.transport.sendMessage(request);
    return resultPromise as Promise<ProtocolResponseType<P, RN>>;
  }

  public onError(cb: (err: Error) => unknown): void {
    this.on("error", cb);
  }

  private processMessage(msg: string | Buffer): void {
    // Parse the message.
    if (typeof msg !== "string") {
      return this.emitError("Protocol client received malformed message.");
    }
    const msgObj = parseProtocolObject(msg);
    if (!msgObj) {
      return this.emitError("Protocol client failed to parse message.");
    }

    // Handle message.
    const { type } = msgObj;
    switch (type) {
      case "response":
        return this.processResponse(msgObj);
      case "error":
        return this.processError(msgObj);
      default:
        return this.emitError(`Unrecognized envelope type ${type}`);
    }
  }

  private processResponse(msgObj: ProtocolObject): void {
    const { id, requestId, result } = msgObj;
    // Validate the response envelope.
    if (typeof id !== "number") {
      return this.emitError("Malformed id in response");
    }
    if (typeof requestId !== "number") {
      return this.emitError("Malformed requestId in response");
    }
    const acceptor = this.activeRequests.get(requestId);
    if (! acceptor) {
      return this.emitError(`Unknown requestId in response: ${requestId}`);
    }

    // Subsequent errors cause the active request to fail.
    this.activeRequests.delete(requestId);

    // Validate the parameters object.
    if (result !== null && !isMessageObject(result)) {
      return acceptor.reject(new Error("Malformed response"));
    }
    if (!this.validator(acceptor.name, result)) {
      return acceptor.reject(new Error("Invalid response"));
    }

    acceptor.resolve(result);
  }

  private processError(msgObj: ProtocolObject): void {
    console.warn("Processing server error message", msgObj);
    const { id, errorKind, requestId, errorMessage } = msgObj;
    // Validate the response envelope.
    if (typeof id !== "number") {
      return this.emitError("Malformed id in error");
    }
    if (typeof errorKind !== "string") {
      return this.emitError("Malformed errorKind in error");
    }
    if (requestId !== undefined && typeof requestId !== "number") {
      return this.emitError("Malformed requestId in error");
    }
    if (errorMessage !== undefined && typeof errorMessage !== "string") {
      return this.emitError("Malformed errorMessage in error");
    }

    if (requestId !== undefined) {
      return this.processRequestError(requestId, errorKind, errorMessage);
    }
    this.emitError(`${errorKind}: ${errorMessage}`);
  }

  private processRequestError(
    requestId: number,
    errorKind: string,
    errorMessage?: string
  ): void {
    const acceptor = this.activeRequests.get(requestId);
    if (! acceptor) {
      return this.emitError(`Unrecognized request id in error: ${requestId}`);
    }

    // Subsequent errors cause the active request to fail.
    this.activeRequests.delete(requestId);
    acceptor.reject(ProtocolClient.makeServerError(errorKind, errorMessage));
  }

  private emitServerError(kind: string, message?: string): void {
    const text = message ? `${kind}: ${message}` : kind;
    this.emit("error", new Error(text));
  }
  private emitError(message: string): void {
    this.emit("error", new Error(message));
  }
  private static makeServerError(kind: string, message?: string): Error {
    const text = message ? `${kind}: ${message}` : kind;
    return new Error(text);
  }
}

type ResponseAcceptor = {
  name: string,
  resolve(result: ProtocolObject | null): void,
  reject(err: Error): void,
};