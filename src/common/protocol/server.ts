import {
  parseProtocolObject,
  isMessageObject
} from "../utility/type-validation";
import { PROTOCOL_CONSTS } from "../constants";
import {
  ProtocolEnvelopeId,
  ProtocolErrorEnvelope,
  ProtocolErrorKind,
  ProtocolEventAttrs,
  ProtocolEventEnvelope,
  ProtocolEventName,
  ProtocolObject,
  ProtocolRequestHandler,
  ProtocolRequestValidator,
  ProtocolResponseEnvelope,
  ProtocolSpec,
  ProtocolTransport
} from "./types";

/**
 * A protocol server that uses an underlying transport.
 */
export class ProtocolServer<P extends ProtocolSpec> {
  private readonly transport: ProtocolTransport;
  private readonly validator: ProtocolRequestValidator<P>;
  private readonly requestHandler: ProtocolRequestHandler<P>;
  private readonly waitingRequests: Set<ProtocolEnvelopeId> = new Set();
  private nextResponseId: number = PROTOCOL_CONSTS.responseIdMod;
  private nextEventId: number = PROTOCOL_CONSTS.eventIdMod;
  private nextErrorId: number = PROTOCOL_CONSTS.errorIdMod;

  constructor(opts: {
    transport: ProtocolTransport,
    validator: ProtocolRequestValidator<P>,
    requestHandler: ProtocolRequestHandler<P>,
  }) {
    const { transport, validator, requestHandler } = opts;
    this.transport = transport;
    this.validator = validator;
    this.requestHandler = requestHandler;
    transport.onMessage(this.processMessage.bind(this));
  }

  public sendEvent<EN extends ProtocolEventName<P>>(
    name: EN,
    attrs: ProtocolEventAttrs<P, EN>
  ): void {
    const id = this.nextEventId;
    this.nextEventId += PROTOCOL_CONSTS.messageIdIncr;
    const event: ProtocolEventEnvelope = { type: "event", name, id, attrs };
    this.transport.sendMessage(event);
  }

  private processMessage(msg: string | Buffer): void {
    if (typeof msg !== "string") {
      return this.transmitError(
        ProtocolErrorKind.MALFORMED_MESSAGE,
        `Message is not a string (type = ${typeof msg})`
      );
    }
    const msgObj = parseProtocolObject(msg);
    if (!msgObj) {
      return this.transmitError(
        ProtocolErrorKind.MALFORMED_MESSAGE,
        `Failed to parse message: ${msg}`
      );
    }
    const { type } = msgObj;
    switch (type) {
      case "request":
        return this.processRequest(msgObj);
      default:
        // TODO: Implement!
        throw new Error(`Unhandled protocol envelope type: ${type}`);
    }
  }

  private processRequest(msgObj: ProtocolObject): void {
    const { id, name, params } = msgObj;
    // Validate the request envelope.
    if (typeof id !== "number") {
      return this.transmitError(ProtocolErrorKind.INVALID_REQUEST_ID);
    }
    if (this.waitingRequests.has(id)) {
      return this.transmitError(ProtocolErrorKind.DUPLICATE_REQUEST_ID);
    }
    if (typeof name !== "string") {
      return this.transmitError(ProtocolErrorKind.INVALID_REQUEST_NAME);
    }

    // Validate the parameters object.
    if (!isMessageObject(params)) {
      return this.transmitError(ProtocolErrorKind.INVALID_REQUEST_PARAMS);
    }
    if (!this.validator(name, params)) {
      return this.transmitError(ProtocolErrorKind.INVALID_REQUEST_PARAMS);
    }
    const handler = (this.requestHandler as any)[name];
    const responsePromise = handler(params) as Promise<ProtocolObject | null>;
    responsePromise
      .then(
        result => this.transmitResponse(id, result),
        err => {
          console.warn("Request threw error", err);
          this.transmitRequestError(
            ProtocolErrorKind.REQUEST_FAILED,
            id,
            err.message
          );
        },
      )
      .finally(() => {
        this.waitingRequests.delete(id);
      });
  }

  private transmitResponse(
    requestId: ProtocolEnvelopeId,
    result: ProtocolObject | null,
  ): void {
    if (result === null) {
      return;
    }
    const id = this.nextResponseId;
    this.nextResponseId += PROTOCOL_CONSTS.messageIdIncr;
    const response: ProtocolResponseEnvelope = {
      type: "response",
      id,
      requestId,
      result
    };
    this.transport.sendMessage(response);
  }

  private transmitRequestError(
    kind: ProtocolErrorKind,
    requestId: ProtocolEnvelopeId,
    message: string
  ): void {
    const id = this.nextErrorId;
    this.nextErrorId += PROTOCOL_CONSTS.messageIdIncr;
    const error: ProtocolErrorEnvelope = {
      type: "error",
      id,
      requestId,
      errorKind: kind,
      errorMessage: message,
    };
    this.transport.sendMessage(error);
  }

  private transmitError(kind: ProtocolErrorKind, message?: string): void {
    console.warn(`Transmitting Error To Client: ${kind}`, new Error().stack);
    const id = this.nextErrorId;
    this.nextErrorId += PROTOCOL_CONSTS.messageIdIncr;
    const error: ProtocolErrorEnvelope = {
      type: "error",
      id,
      errorKind: kind
    };
    if (message) {
      this.transport.sendMessage({ ...error, errorMessage: message });
    } else {
      this.transport.sendMessage(error);
    }
  }
}