import { render } from "@react-email/components";
import { resend, EMAIL_FROM } from "./client";
import { InviteEmail, type InviteEmailProps } from "./templates/invite";
import { ActionPlanPublishedEmail, type ActionPlanPublishedEmailProps } from "./templates/action-plan-published";
import { DeliverableSubmittedEmail, type DeliverableSubmittedEmailProps } from "./templates/deliverable-submitted";
import { DeliverableApprovedEmail, type DeliverableApprovedEmailProps } from "./templates/deliverable-approved";
import { DeliverableSentBackEmail, type DeliverableSentBackEmailProps } from "./templates/deliverable-sent-back";
import { ActionApprovedEmail, type ActionApprovedEmailProps } from "./templates/action-approved";
import { ActionAssignedEmail, type ActionAssignedEmailProps } from "./templates/action-assigned";

async function send(to: string, subject: string, html: string, tag: string): Promise<void> {
  try {
    const { data, error } = await resend.emails.send({ from: EMAIL_FROM, to, subject, html });
    if (error) {
      console.error(`[email:${tag}] Resend error sending to ${to}:`, error);
    } else {
      console.log(`[email:${tag}] sent to ${to} (id=${data?.id})`);
    }
  } catch (err) {
    console.error(`[email:${tag}] unexpected error sending to ${to}:`, err);
  }
}

export async function sendInviteEmail(
  to: string,
  props: InviteEmailProps
): Promise<void> {
  const subject = `You've been invited to join ${props.workspaceName} on Trace`;
  const html = await render(InviteEmail(props));
  await send(to, subject, html, "invite");
}

export async function sendActionPlanPublishedEmail(
  to: string,
  props: ActionPlanPublishedEmailProps
): Promise<void> {
  const subject = `Action plan published for ${props.projectName}`;
  const html = await render(ActionPlanPublishedEmail(props));
  await send(to, subject, html, "action-plan-published");
}

export async function sendDeliverableSubmittedEmail(
  to: string,
  props: DeliverableSubmittedEmailProps
): Promise<void> {
  const subject = `New submission: ${props.actionNumber}${props.deliverableLetter} — ${props.actionTitle}`;
  const html = await render(DeliverableSubmittedEmail(props));
  await send(to, subject, html, "deliverable-submitted");
}

export async function sendDeliverableApprovedEmail(
  to: string,
  props: DeliverableApprovedEmailProps
): Promise<void> {
  const subject = `Approved: ${props.actionNumber}${props.deliverableLetter} — ${props.actionTitle}`;
  const html = await render(DeliverableApprovedEmail(props));
  await send(to, subject, html, "deliverable-approved");
}

export async function sendDeliverableSentBackEmail(
  to: string,
  props: DeliverableSentBackEmailProps
): Promise<void> {
  const subject = `Revision needed: ${props.actionNumber}${props.deliverableLetter} — ${props.actionTitle}`;
  const html = await render(DeliverableSentBackEmail(props));
  await send(to, subject, html, "deliverable-sent-back");
}

export async function sendActionApprovedEmail(
  to: string,
  props: ActionApprovedEmailProps
): Promise<void> {
  const subject = `Action ${props.actionNumber} fully approved — ${props.actionTitle}`;
  const html = await render(ActionApprovedEmail(props));
  await send(to, subject, html, "action-approved");
}

export async function sendActionAssignedEmail(
  to: string,
  props: ActionAssignedEmailProps
): Promise<void> {
  const subject = `You've been assigned: ${props.actionNumber}${props.deliverableLetter} in ${props.projectName}`;
  const html = await render(ActionAssignedEmail(props));
  await send(to, subject, html, "action-assigned");
}
